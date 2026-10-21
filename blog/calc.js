/* Bud's targets and BMI maths, for the two calculators on this blog.
 *
 * Every constant comes from the JSON block on the page itself
 * (<script type="application/json" id="bud-method">), which is a copy of
 * `body.METHOD` in the bud repo - the code that works out the numbers a user
 * is shown on WhatsApp. tests/test_method_on_website.py there compares the two,
 * so this file holds formulas and no numbers: a constant changed in one place
 * and not the other fails a test instead of giving a visitor a different
 * answer from the one the bot gives.
 *
 * Rounding follows Python's round() - ties go to the even number - because
 * that is what the bot does, and a calculator that disagreed by one gram on
 * the odd input would be a calculator that disagrees.
 */
(function () {
  'use strict';

  var node = document.getElementById('bud-method');
  if (!node) return;
  var M = JSON.parse(node.textContent);

  function pyRound(x) {
    var f = Math.floor(x);
    var d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }

  function round1(x) { return pyRound(x * 10) / 10; }

  var GOAL_LABELS = {
    'general': 'General nutrition',
    'weight-loss': 'Weight loss',
    'diabetes': 'Diabetes care',
    'muscle': 'Muscle building',
    'glp1': 'GLP-1 monitoring'
  };
  var ACTIVITY_LABELS = {
    sedentary: 'Mostly sitting',
    light: 'Lightly active',
    moderate: 'Moderately active',
    heavy: 'Very active'
  };

  function bmi(weight, height) {
    var m = height / 100;
    return round1(weight / (m * m));
  }

  function band(value) {
    for (var i = 0; i < M.bmi_bands.length; i++) {
      var ceiling = M.bmi_bands[i][0];
      if (ceiling === null || value < ceiling) return M.bmi_bands[i][1];
    }
    return M.bmi_bands[M.bmi_bands.length - 1][1];
  }

  function healthyRange(height) {
    var m = height / 100;
    return [pyRound(18.5 * m * m), pyRound(24.9 * m * m)];
  }

  function bmrFor(weight, age, sex) {
    var bands = M.bmr_equations[sex];
    var slope = 0, intercept = 0, upper = 0, lower = 0;
    for (var i = 0; i < bands.length; i++) {
      slope = bands[i][1];
      intercept = bands[i][2];
      upper = bands[i][0];
      if (age < upper) break;
      lower = upper;
    }
    var raw = slope * weight + intercept;
    var cut = age >= M.adult_age ? M.indian_bmr_factor[sex] : 1;
    var label = upper === M.adult_age ? 'under ' + M.adult_age
      : (upper >= 200 ? lower + '+' : lower + '–' + upper);
    return { raw: raw, value: pyRound(raw * cut), cut: cut, slope: slope, intercept: intercept,
             band: label };
  }

  function normalise(goals) {
    var picked = (M.lead_order || []).filter(function (g) { return goals.indexOf(g) !== -1; });
    if (picked.length > 1) picked = picked.filter(function (g) { return g !== 'general'; });
    return picked.length ? picked : ['general'];
  }

  function perKg(goal, bmiValue) {
    if (goal === 'diabetes' && bmiValue >= M.diabetes_loss_bmi) return M.protein_g_per_kg['weight-loss'];
    return M.protein_g_per_kg[goal];
  }

  function direction(goal, bmiValue, age) {
    if (goal === 'muscle') return 'surplus';
    var wantsLoss = goal === 'weight-loss' || goal === 'glp1' ||
      (goal === 'diabetes' && bmiValue >= M.diabetes_loss_bmi);
    if (wantsLoss && bmiValue >= M.no_deficit_below_bmi && age >= M.adult_age) return 'deficit';
    return 'maintain';
  }

  function targets(input) {
    var picked = normalise(input.goals || []);
    var goal = picked[0];
    var sex = input.sex === 'female' ? 'female' : 'male';
    var level = M.pal[input.activity] ? input.activity : 'sedentary';
    var bmiValue = bmi(input.weight, input.height);
    var resting = bmrFor(input.weight, input.age, sex);
    var maintenance = pyRound(resting.value * M.pal[level]);
    var dir = direction(goal, bmiValue, input.age);
    var kcal = dir === 'deficit' ? maintenance - M.deficit_kcal
      : dir === 'surplus' ? maintenance * (1 + M.surplus_share) : maintenance;
    var floor = (goal === 'glp1' ? M.glp1_min_kcal : M.min_kcal)[sex];
    var floored = kcal < floor;
    if (floored) kcal = floor;
    kcal = pyRound(kcal / 10) * 10;

    var g = 0;
    picked.forEach(function (p) { g = Math.max(g, perKg(p, bmiValue)); });
    var m = input.height / 100;
    var cap = M.protein_reference_bmi * m * m;
    var proteinWeight = Math.min(input.weight, cap);
    var protein = pyRound(proteinWeight * g);
    var fat = pyRound(kcal * M.fat_share / M.kcal_per_g.fat);
    var remaining = kcal - protein * M.kcal_per_g.protein - fat * M.kcal_per_g.fat;
    if (remaining < 0) remaining = 0;
    var carbs = pyRound(remaining / M.kcal_per_g.carbs);

    return {
      kcal: kcal, protein: protein, carbs: carbs, fat: fat, fibre: M.fibre_g,
      goal: goal, goals: picked, sex: sex, level: level, bmi: bmiValue,
      resting: resting, maintenance: maintenance, direction: dir, floor: floor, floored: floored,
      perKg: g, proteinWeight: proteinWeight, capped: input.weight > cap
    };
  }

  function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }
  function $(id) { return document.getElementById(id); }

  function readHeight(form) {
    var unit = form.querySelector('input[name="hunit"]:checked');
    if (unit && unit.value === 'ft') {
      var ft = parseFloat(form.elements.ft.value);
      var inch = parseFloat(form.elements.inch.value || '0');
      if (!isFinite(ft)) return NaN;
      return (ft * 12 + (isFinite(inch) ? inch : 0)) * 2.54;
    }
    return parseFloat(form.elements.cm.value);
  }

  function wireUnits(form) {
    var cm = form.querySelector('[data-unit="cm"]');
    var ft = form.querySelector('[data-unit="ft"]');
    if (!cm || !ft) return;
    function sync() {
      var useFt = form.querySelector('input[name="hunit"]:checked').value === 'ft';
      cm.hidden = useFt;
      ft.hidden = !useFt;
    }
    Array.prototype.forEach.call(form.querySelectorAll('input[name="hunit"]'), function (r) {
      r.addEventListener('change', sync);
    });
    sync();
  }

  function setInvalid(input, bad) {
    if (!input) return;
    if (bad) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function inRange(x, lo, hi) { return isFinite(x) && x >= lo && x <= hi; }

  /* ------------------------------------------------ the targets calculator */
  function wireTargets() {
    var form = $('targets-form');
    if (!form) return;
    wireUnits(form);
    var out = $('targets-result');
    var empty = $('targets-empty');

    function render() {
      var age = parseFloat(form.elements.age.value);
      var weight = parseFloat(form.elements.weight.value);
      var height = readHeight(form);
      var sexEl = form.querySelector('input[name="sex"]:checked');
      var actEl = form.querySelector('input[name="activity"]:checked');
      var goals = Array.prototype.map.call(
        form.querySelectorAll('input[name="goal"]:checked'), function (c) { return c.value; });

      var okAge = inRange(age, 13, 100);
      var okWeight = inRange(weight, 25, 300);
      var okHeight = inRange(height, 120, 230);
      setInvalid(form.elements.age, form.elements.age.value !== '' && !okAge);
      setInvalid(form.elements.weight, form.elements.weight.value !== '' && !okWeight);
      if (!(okAge && okWeight && okHeight && sexEl && actEl)) {
        out.hidden = true;
        empty.hidden = false;
        return;
      }
      var t = targets({ age: Math.floor(age), weight: weight, height: height,
                        sex: sexEl.value, activity: actEl.value, goals: goals });
      empty.hidden = true;
      out.hidden = false;

      $('r-goal').textContent = t.goals.map(function (g) { return GOAL_LABELS[g]; }).join(' + ') + ' · your daily targets';
      $('r-kcal').textContent = fmt(t.kcal);
      var biggest = Math.max(t.protein, t.carbs, t.fat, t.fibre) || 1;
      [['protein', t.protein], ['carbs', t.carbs], ['fat', t.fat], ['fibre', t.fibre]].forEach(function (p) {
        $('r-' + p[0]).textContent = p[1] + ' g';
        $('b-' + p[0]).style.width = Math.max(4, Math.round(100 * p[1] / biggest)) + '%';
      });

      var sexWord = t.sex === 'male' ? 'men' : 'women';
      var steps = [];
      steps.push('Resting energy: ' + t.resting.slope + ' × ' + round1(weight) + ' kg + ' +
        t.resting.intercept + ' = <span>' + fmt(t.resting.raw) + ' kcal</span> (FAO/WHO/UNU equation for ' +
        sexWord + ' aged ' + t.resting.band + ')' +
        (t.resting.cut < 1 ? ', less ' + Math.round((1 - t.resting.cut) * 100) + '% for Indian adults = <span>' +
          fmt(t.resting.value) + ' kcal</span>' : ''));
      steps.push('× ' + M.pal[t.level] + ' for “' + ACTIVITY_LABELS[t.level] + '” = <span>' +
        fmt(t.maintenance) + ' kcal</span> to stay where you are');
      var goalStep;
      if (t.direction === 'deficit') goalStep = '− ' + M.deficit_kcal + ' kcal for ' + (t.goal === 'diabetes' ? 'weight loss (BMI 25 or more)' : GOAL_LABELS[t.goal].toLowerCase());
      else if (t.direction === 'surplus') goalStep = '+ ' + Math.round(M.surplus_share * 100) + '% to build muscle';
      else {
        var why = 'maintenance';
        if (t.goal !== 'general') {
          if (age < M.adult_age) why = 'no deficit under ' + M.adult_age;
          else if (t.bmi < M.no_deficit_below_bmi) why = 'no deficit below a BMI of ' + M.no_deficit_below_bmi;
          else if (t.goal === 'diabetes') why = 'BMI under ' + M.diabetes_loss_bmi + ', so maintenance';
        }
        goalStep = 'No change: ' + why;
      }
      if (t.floored) goalStep += ', raised to the ' + fmt(t.floor) + ' kcal floor';
      steps.push(goalStep + ' = <span>' + fmt(t.kcal) + ' kcal</span>');
      steps.push('Protein: ' + t.perKg + ' g per kg × ' + round1(t.proteinWeight) + ' kg' +
        (t.capped ? ' (the top of the healthy range for your height)' : '') + ' = <span>' + t.protein + ' g</span>');
      steps.push('Fat: 25% of calories ÷ 9 = <span>' + t.fat + ' g</span>. Carbs: what is left ÷ 4 = <span>' +
        t.carbs + ' g</span>. Fibre: <span>' + t.fibre + ' g</span>');
      $('r-steps').innerHTML = steps.map(function (s) { return '<li>' + s + '</li>'; }).join('');

      var range = healthyRange(height);
      $('r-bmi').innerHTML = 'Your BMI is <b>' + t.bmi.toFixed(1) + '</b> (' + band(t.bmi) +
        ', WHO). Healthy for your height is <b>' + range[0] + '–' + range[1] + ' kg</b>. ' +
        '<a href="/blog/bmi-calculator">How BMI is worked out</a>.';
    }

    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); });
    render();
  }

  /* ---------------------------------------------------- the BMI calculator */
  function wireBmi() {
    var form = $('bmi-form');
    if (!form) return;
    wireUnits(form);
    var out = $('bmi-result');
    var empty = $('bmi-empty');
    var lo = 15, hi = 35;

    function render() {
      var weight = parseFloat(form.elements.weight.value);
      var height = readHeight(form);
      var ok = inRange(weight, 25, 300) && inRange(height, 120, 230);
      setInvalid(form.elements.weight, form.elements.weight.value !== '' && !inRange(weight, 25, 300));
      if (!ok) { out.hidden = true; empty.hidden = false; return; }
      empty.hidden = true;
      out.hidden = false;
      var value = bmi(weight, height);
      var name = band(value);
      var range = healthyRange(height);
      $('bmi-value').textContent = value.toFixed(1);
      $('bmi-band').textContent = name;
      $('bmi-band').style.color = name === 'healthy' ? 'var(--healthy)' : (name === 'obese' ? 'var(--warn)' : 'var(--caution)');
      $('bmi-range').innerHTML = 'Healthy for your height: <b>' + range[0] + '–' + range[1] + ' kg</b> (a BMI of 18.5 to 24.9).';
      var pos = (Math.max(lo, Math.min(hi, value)) - lo) / (hi - lo) * 100;
      $('bmi-marker').style.left = pos + '%';
    }

    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); });
    render();
  }

  wireTargets();
  wireBmi();
})();
