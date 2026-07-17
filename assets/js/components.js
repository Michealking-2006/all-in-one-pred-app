/*==========================================
  Season Picker
  SPA Safe
==========================================*/

let seasonPickerInitialized = false;

function initSeasonPicker() {
  
  const picker = document.getElementById("seasonPicker");
  if (!picker) return;
  
  if (picker.dataset.initialized === "true") return;
  picker.dataset.initialized = "true";
  
  const trigger = document.getElementById("seasonTrigger");
  const dropdown = document.getElementById("seasonDropdown");
  const label = document.getElementById("seasonLabel");
  const nativeSelect = document.getElementById("seasonSelect");
  
  const options = [...picker.querySelectorAll(".season-option")];
  
  /*-------------------------
    Toggle
  -------------------------*/
  
  function openPicker() {
    picker.classList.add("open");
  }
  
  function closePicker() {
    picker.classList.remove("open");
  }
  
  function togglePicker() {
    picker.classList.toggle("open");
  }
  
  /*-------------------------
    Update Selection
  -------------------------*/
  
  function setValue(value, text) {
    
    label.textContent = text;
    
    options.forEach(option => {
      option.classList.toggle(
        "active",
        option.dataset.value === value
      );
    });
    
    if (nativeSelect) {
      
      nativeSelect.value = value;
      
      nativeSelect.dispatchEvent(
        new Event("change", {
          bubbles: true
        })
      );
      
    }
    
  }
  
  /*-------------------------
    Initial State
  -------------------------*/
  
  if (nativeSelect) {
    
    const selected =
      nativeSelect.options[nativeSelect.selectedIndex];
    
    if (selected) {
      label.textContent = selected.textContent;
    }
    
  }
  
  /*-------------------------
    Events
  -------------------------*/
  
  trigger.addEventListener("click", e => {
    e.stopPropagation();
    togglePicker();
  });
  
  options.forEach(option => {
    
    option.addEventListener("click", () => {
      
      setValue(
        option.dataset.value,
        option.dataset.label
      );
      
      closePicker();
      
    });
    
  });
  
  /*-------------------------
    Click Outside
  -------------------------*/
  
  document.addEventListener("click", e => {
    
    if (!picker.contains(e.target)) {
      closePicker();
    }
    
  });
  
  /*-------------------------
    Keyboard
  -------------------------*/
  
  trigger.addEventListener("keydown", e => {
    
    const current =
      options.findIndex(x =>
        x.classList.contains("active")
      );
    
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePicker();
      return;
    }
    
    if (!picker.classList.contains("open")) return;
    
    if (e.key === "Escape") {
      closePicker();
      return;
    }
    
    if (e.key === "ArrowDown") {
      
      e.preventDefault();
      
      const next =
        options[Math.min(current + 1, options.length - 1)];
      
      next.focus();
      
    }
    
    if (e.key === "ArrowUp") {
      
      e.preventDefault();
      
      const prev =
        options[Math.max(current - 1, 0)];
      
      prev.focus();
      
    }
    
  });
  
}

/*==========================================
  SPA Init
==========================================*/

initSeasonPicker();
document.addEventListener("pageLoaded", initSeasonPicker);