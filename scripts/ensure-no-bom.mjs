import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const pkg = join(process.cwd(), "package.json");
let text = readFileSync(pkg, "utf8");
if (text.charCodeAt(0) === 0xfeff) {
  writeFileSync(pkg, text.slice(1), "utf8");
  console.log("Removed BOM from package.json");
}
