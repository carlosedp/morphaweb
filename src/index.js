import Morphaweb from "./Morphaweb";
const version = "snapshot";

const morphaweb = new Morphaweb();

const versionElement = document.getElementById("version");
versionElement.textContent = version;
