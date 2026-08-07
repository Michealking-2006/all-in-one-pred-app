(() => {
  class AppScript extends HTMLElement {
    connectedCallback() {
      const src = this.getAttribute("src");
      if (!src) return;

      // Prevent duplicate loading
      if (document.querySelector(`script[data-app-script="${src}"]`)) return;

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.appScript = src;

      document.body.appendChild(script);
    }
  }

  customElements.define("app-script", AppScript);
})();