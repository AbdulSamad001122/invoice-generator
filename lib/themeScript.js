// Plain (non-client) module so the server layout can inline this script.
// Runs in <head> before the page paints, so there is no flash of the wrong theme.
// Keep in sync with getStoredTheme/applyTheme in contexts/ThemeContext.js.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
