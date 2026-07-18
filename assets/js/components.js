function initSeasonPicker() {
  
  const picker = document.getElementById("seasonPicker");
  if (!picker) return;
  
  if (picker.dataset.bound === "true") return;
  picker.dataset.bound = "true";
  
  const trigger = picker.querySelector("#seasonTrigger");
  const label = picker.querySelector("#seasonLabel");
  const select = document.getElementById("seasonSelect");
  const options = [...picker.querySelectorAll(".season-option")];
  
  // Initial value
  const selected = select.options[select.selectedIndex];
  if (selected) {
    label.textContent = selected.textContent;
  }
  
  /* Trigger */
  
  trigger.addEventListener("click", function(e) {
    e.stopPropagation();
    picker.classList.toggle("open");
  });
  
  /* Options */
  
  options.forEach(option => {
    
    option.addEventListener("click", function(e) {
      
      e.stopPropagation();
      
      options.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");
      
      const value = this.dataset.value;
      const text = this.dataset.label;
      
      label.textContent = text;
      select.value = value;
      
      select.dispatchEvent(new Event("change", {
        bubbles: true
      }));
      
      picker.classList.remove("open");
      
    });
    
  });
  
  /* Close outside */
  
  document.addEventListener("click", function(e) {
    
    if (!picker.contains(e.target)) {
      picker.classList.remove("open");
    }
    
  });
  
}

initSeasonPicker();
document.addEventListener("pageLoaded", initSeasonPicker);