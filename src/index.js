import Morphaweb from "./Morphaweb";
const version = "v2.0";

const morphaweb = new Morphaweb();

const versionElement = document.getElementById("version");
versionElement.textContent = version;
