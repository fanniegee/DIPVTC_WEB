(function () {
  const CONDITIONS = ["HIV/AIDS","Cancer","Diabetes","Asthma","Epilepsy / seizures","Sickle cell disease","Heart condition","High blood pressure","Kidney condition","Anaemia","Tuberculosis (TB)","Chronic skin condition","Mental health condition","Physical disability","Vision condition","Hearing condition","Other"];
  const ALLERGIES = ["Peanuts","Tree nuts","Milk / dairy","Eggs","Fish","Shellfish","Wheat / gluten","Soy","Penicillin / antibiotics","Other medicines","Pollen","Dust mites","Mould","Insect stings","Latex","Animal dander","Other"];
  function mount(container) {
    container.innerHTML = `
      <fieldset class="health-box">
        <legend>Student Health Information</legend>
        <p class="health-help">This information is private and is available to authorised school admissions and administration staff. Select “No known…” only if the learner has no known condition or allergy.</p>
        <div class="health-field"><label for="healthConditionStatus">Known health conditions</label><select id="healthConditionStatus" required><option value="">Choose one</option><option value="none">No known health conditions</option><option value="has_conditions">One or more health conditions</option></select></div>
        <div id="healthConditionChoices" class="health-field" hidden><span class="health-label">Select all that apply</span><div class="health-options">${CONDITIONS.map((x,i)=>'<label><input type="checkbox" name="healthConditions" value="'+x+'" id="hc'+i+'"><span>'+x+'</span></label>').join("")}</div><label for="healthConditionOther">Other health problem not listed</label><input id="healthConditionOther" maxlength="500" placeholder="Describe any other condition"></div>
        <div class="health-field"><label for="hasAllergies">Does the learner have any known allergies?</label><select id="hasAllergies" required><option value="">Choose Yes or No</option><option value="no">No known allergies</option><option value="yes">Yes, one or more allergies</option></select></div>
        <div id="allergyChoices" class="health-field" hidden><span class="health-label">Select all known allergies</span><div class="health-options">${ALLERGIES.map((x,i)=>'<label><input type="checkbox" name="allergies" value="'+x+'" id="al'+i+'"><span>'+x+'</span></label>').join("")}</div><label for="allergyOther">Other allergy not listed</label><input id="allergyOther" maxlength="500" placeholder="Describe any other allergy"></div>
        <div id="doctorDetails" class="health-doctor" hidden><h3>Doctor / clinic details</h3><p class="health-help">Please provide the learner’s doctor or clinic contact details when reporting a condition or allergy.</p><div class="health-grid">
          <div><label for="doctorName">Doctor’s full name *</label><input id="doctorName" maxlength="180"></div>
          <div><label for="doctorClinic">Clinic / medical practice *</label><input id="doctorClinic" maxlength="180"></div>
          <div><label for="doctorPhone">Doctor / clinic phone *</label><input id="doctorPhone" type="tel" maxlength="40"></div>
          <div><label for="doctorEmail">Doctor / clinic email (if available)</label><input id="doctorEmail" type="email" maxlength="254"></div>
          <div class="health-wide"><label for="doctorAddress">Clinic address (if available)</label><input id="doctorAddress" maxlength="500"></div>
          <div class="health-wide"><label for="healthNotes">Relevant care instructions / emergency plan</label><textarea id="healthNotes" rows="3" maxlength="2000" placeholder="Medication, triggers, emergency steps, or other instructions the school should know"></textarea></div>
        </div></div>
      </fieldset>
      <style>
        .health-box{border:1px solid #d9e2ee;border-radius:12px;padding:16px;margin:10px 0;color:#172b49;min-width:0}.health-box legend{font-weight:900;font-size:14px;padding:0 6px}.health-help{font-size:11px;line-height:1.6;color:#64748b;margin:4px 0 12px}.health-field{display:grid;gap:7px;margin:12px 0}.health-field>label,.health-label,.health-doctor label{font-size:10px;font-weight:800;text-transform:uppercase;color:#52647e}.health-box select,.health-box input:not([type=checkbox]),.health-box textarea{width:100%;min-height:40px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#172b49;font:500 12px Montserrat,Arial,sans-serif}.health-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.health-options label{display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font:500 11px Montserrat,Arial,sans-serif;text-transform:none}.health-options input{accent-color:#e67e22}.health-doctor{border-top:1px solid #e2e8f0;margin-top:14px;padding-top:8px}.health-doctor h3{font-size:13px;margin:4px 0}.health-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.health-grid>div{display:grid;gap:6px}.health-grid .health-wide{grid-column:1/-1}@media(max-width:580px){.health-grid{grid-template-columns:1fr}.health-grid .health-wide{grid-column:auto}}
      </style>`;
    const $ = id => container.querySelector("#" + id);
    const conditionStatus = $("healthConditionStatus"), allergyStatus = $("hasAllergies");
    const conditionChoices = $("healthConditionChoices"), allergyChoices = $("allergyChoices"), doctor = $("doctorDetails");
    const condOther = $("healthConditionOther"), allergyOther = $("allergyOther");
    const doctorName = $("doctorName"), doctorClinic = $("doctorClinic"), doctorPhone = $("doctorPhone");
    function sync() {
      const hasCondition = conditionStatus.value === "has_conditions", hasAllergy = allergyStatus.value === "yes";
      conditionChoices.hidden = !hasCondition; allergyChoices.hidden = !hasAllergy; doctor.hidden = !(hasCondition || hasAllergy);
      const condChecked = [...container.querySelectorAll('[name="healthConditions"]:checked')], allergyChecked = [...container.querySelectorAll('[name="allergies"]:checked')];
      condOther.required = hasCondition && condChecked.some(x=>x.value==="Other");
      allergyOther.required = hasAllergy && allergyChecked.some(x=>x.value==="Other");
      for (const input of [doctorName,doctorClinic,doctorPhone]) input.required = !doctor.hidden;
    }
    container.addEventListener("change", sync);
    function values() {
      const selected = name => [...container.querySelectorAll('[name="'+name+'"]:checked')].map(x=>x.value);
      return {
        healthConditionStatus:conditionStatus.value,
        healthConditions:conditionStatus.value==="has_conditions"?selected("healthConditions").filter(x=>x!=="Other"):[],
        healthConditionOther:conditionStatus.value==="has_conditions"?condOther.value.trim():"",
        hasAllergies:allergyStatus.value==="yes",
        allergies:allergyStatus.value==="yes"?selected("allergies").filter(x=>x!=="Other"):[],
        allergyOther:allergyStatus.value==="yes"?allergyOther.value.trim():"",
        doctorName:doctor.hidden?"":doctorName.value.trim(), doctorClinic:doctor.hidden?"":doctorClinic.value.trim(),
        doctorPhone:doctor.hidden?"":doctorPhone.value.trim(), doctorEmail:doctor.hidden?"":$("doctorEmail").value.trim(),
        doctorAddress:doctor.hidden?"":$("doctorAddress").value.trim(), healthNotes:doctor.hidden?"":$("healthNotes").value.trim()
      };
    }
    function validate() {
      sync();
      if (!conditionStatus.value || !allergyStatus.value) { (conditionStatus.value?allergyStatus:conditionStatus).reportValidity(); return false; }
      if (conditionStatus.value==="has_conditions" && !container.querySelector('[name="healthConditions"]:checked') && !condOther.value.trim()) { condOther.setCustomValidity("Select a condition or describe another condition."); condOther.reportValidity(); condOther.setCustomValidity(""); return false; }
      if (allergyStatus.value==="yes" && !container.querySelector('[name="allergies"]:checked') && !allergyOther.value.trim()) { allergyOther.setCustomValidity("Select an allergy or describe another allergy."); allergyOther.reportValidity(); allergyOther.setCustomValidity(""); return false; }
      return container.querySelector("fieldset").reportValidity();
    }
    function set(data={}) {
      conditionStatus.value=data.health_condition_status||data.healthConditionStatus||"";
      allergyStatus.value=(data.has_allergies===true||data.hasAllergies===true)?"yes":(data.has_allergies===false||data.hasAllergies===false)?"no":"";
      const conditions=data.health_conditions||data.healthConditions||[], allergies=data.allergies||[];
      for(const input of container.querySelectorAll('[name="healthConditions"]'))input.checked=conditions.includes(input.value)||(input.value==="Other"&&!!(data.health_condition_other||data.healthConditionOther));
      for(const input of container.querySelectorAll('[name="allergies"]'))input.checked=allergies.includes(input.value)||(input.value==="Other"&&!!(data.allergy_other||data.allergyOther));
      condOther.value=data.health_condition_other||data.healthConditionOther||"";allergyOther.value=data.allergy_other||data.allergyOther||"";
      $("doctorName").value=data.doctor_name||data.doctorName||"";$("doctorClinic").value=data.doctor_clinic||data.doctorClinic||"";
      $("doctorPhone").value=data.doctor_phone||data.doctorPhone||"";$("doctorEmail").value=data.doctor_email||data.doctorEmail||"";
      $("doctorAddress").value=data.doctor_address||data.doctorAddress||"";$("healthNotes").value=data.health_notes||data.healthNotes||"";sync();
    }
    function reset() {
      conditionStatus.value="";allergyStatus.value="";
      for(const input of container.querySelectorAll('input[type="checkbox"]'))input.checked=false;
      for(const id of ["healthConditionOther","allergyOther","doctorName","doctorClinic","doctorPhone","doctorEmail","doctorAddress","healthNotes"])$(id).value="";
      sync();
    }
    return {values,validate,set,reset};
  }
  window.DIPVTCHealthForm={mount};
})();