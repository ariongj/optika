import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../public/assets/fonts/fonts.css";
import "./styles/global.css";
import "./styles/site-2026.css";
import "./styles/editorial.css";
import "./styles/service-refinement.css";
import "./styles/checkout-experience.css";
import "./styles/holding-group.css";
import "./styles/whole-site.css";
import "./styles/division-retail.css";
import "./styles/lab-markets.css";
import "./styles/clinic-department.css";
import "./styles/navigation-forms.css";
import "./styles/mega-navigation.css";
import "./styles/lens-focus.css";
import "./styles/seo-links.css";
import "./styles/page-character.css";
import atelierStyles from "./styles/atelier.css?url";
import experienceStyles from "./styles/atelier-experience.css?url";

// Keep the retail layer separate from the legacy application stylesheet.
// Its link follows the base stylesheet so the intended cascade is explicit.
const retailStyles = document.createElement('link');
retailStyles.rel = 'stylesheet';
retailStyles.href = atelierStyles;
document.head.appendChild(retailStyles);
const experienceLink = document.createElement('link');
experienceLink.rel = 'stylesheet';
experienceLink.href = experienceStyles;
document.head.appendChild(experienceLink);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
