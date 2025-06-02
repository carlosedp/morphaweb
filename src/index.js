import Morphaweb from "./Morphaweb";
const version = "v1.1";

const morphaweb = new Morphaweb();

const versionElement = document.getElementById("version");
versionElement.textContent = version;
