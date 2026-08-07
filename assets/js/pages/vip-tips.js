/*==================================================
  VIP TIPS PAGE
==================================================*/

function initVipTipsPage() {
  
  const page = document.querySelector(".app");
  
  if (!page) return;
  
  if (page.dataset.vipInitialized === "true") return;
  
  page.dataset.vipInitialized = "true";
  
  page.addEventListener("click", handleVipTipsClick);
  
  initOddsSlider(page);
  
}


/*==================================================
  CLICK HANDLER
==================================================*/

function handleVipTipsClick(event) {
  
  const target = event.target;
  
  
  /*----------------------------------
    TOP TABS
  ----------------------------------*/
  
  const topTab = target.closest(".top-tab");
  
  if (topTab) {
    
    document
      .querySelectorAll(".top-tab")
      .forEach(tab => tab.classList.remove("active"));
    
    document
      .querySelector(".slip-btn")
      ?.classList.remove("active");
    
    topTab.classList.add("active");
    
    return;
  }
  
  
  /*----------------------------------
    SLIP GENERATOR
  ----------------------------------*/
  
  const slipButton = target.closest(".slip-btn");
  
  if (slipButton) {
    
    document
      .querySelectorAll(".top-tab")
      .forEach(tab => tab.classList.remove("active"));
    
    slipButton.classList.add("active");
    
    return;
  }
  
  
  /*----------------------------------
    NUMBER OF GAMES
  ----------------------------------*/
  
  const numberButton = target.closest(".number-btn");
  
  if (numberButton) {
    
    document
      .querySelectorAll(".number-btn")
      .forEach(button => {
        
        button.classList.remove("active");
        
      });
    
    numberButton.classList.add("active");
    
    return;
  }
  
  
  /*----------------------------------
    RISK LEVEL
  ----------------------------------*/
  
  const riskButton = target.closest(".seg-btn");
  
  if (riskButton) {
    
    document
      .querySelectorAll("#riskGroup .seg-btn")
      .forEach(button => {
        
        button.classList.remove("active");
        
      });
    
    riskButton.classList.add("active");
    
    return;
  }
  
  
  /*----------------------------------
    LEAGUE CHIPS
  ----------------------------------*/
  
  const leagueChip = target.closest("#leagueChips .chip");
  
  if (leagueChip) {
    
    leagueChip.classList.toggle("selected");
    leagueChip.classList.toggle("light");
    
    return;
  }
  
  
  /*----------------------------------
    BET TYPE CHIPS
  ----------------------------------*/
  
  const betChip = target.closest("#betChips .chip");
  
  if (betChip) {
    
    betChip.classList.toggle("selected");
    betChip.classList.toggle("light");
    
    return;
  }
  
  
  /*----------------------------------
    VIP TAB
  ----------------------------------*/
  
  const vipTab = target.closest(".league-tab");
  
  if (vipTab) {
    
    document
      .querySelectorAll(".league-tab")
      .forEach(tab => {
        
        tab.classList.remove("active");
        
      });
    
    vipTab.classList.add("active");
    
    return;
  }
  
  
  /*----------------------------------
    ACCORDION
  ----------------------------------*/
  
  const leagueRow = target.closest(".league-row");
  
  if (leagueRow) {
    
    const currentCard = leagueRow.closest(".league-item");
    
    const opened = currentCard.classList.contains("open");
    
    document
      .querySelectorAll(".league-item")
      .forEach(card => {
        
        card.classList.remove("open");
        
        const arrow = card.querySelector(".chev");
        
        if (arrow) {
          
          arrow.textContent = "›";
          
        }
        
      });
    
    if (!opened) {
      
      currentCard.classList.add("open");
      
      const arrow = currentCard.querySelector(".chev");
      
      if (arrow) {
        
        arrow.textContent = "⌄";
        
      }
      
    }
    
    return;
  }
  
  
  /*----------------------------------
    GENERATE BUTTON
  ----------------------------------*/
  
  const generateButton = target.closest(".generate-btn");
  
  if (generateButton) {
    
    console.log("Generate Slip");
    
    return;
  }
  
}


/*==================================================
  ODDS SLIDER
==================================================*/

function initOddsSlider(page) {
  
  const slider = page.querySelector("#oddsRange");
  const value = page.querySelector("#oddsValue");
  
  if (!slider || !value) return;
  
  value.textContent = Number(slider.value).toFixed(2);
  
  slider.oninput = () => {
    
    value.textContent =
      Number(slider.value).toFixed(2);
    
  };
  
}

initVipTipsPage();