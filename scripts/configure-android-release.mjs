import fs from "node:fs";

const buildFile = "android/app/build.gradle";
const packageInfo = JSON.parse(fs.readFileSync("package.json", "utf8"));
const versionName = process.env.APP_VERSION_NAME || packageInfo.version || "1.0.0";
const numbers = versionName.split(".").map((value) => Number.parseInt(value, 10) || 0);
const versionCode = Number(process.env.APP_VERSION_CODE) || ((numbers[0] || 1) * 10000 + (numbers[1] || 0) * 100 + (numbers[2] || 0));

let build = fs.readFileSync(buildFile, "utf8");
build = build.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
build = build.replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`);

const signingConfig = `
    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;

if (!build.includes("signingConfigs {")) {
  build = build.replace("android {", `android {${signingConfig}`);
}
if (!build.includes("signingConfig signingConfigs.release")) {
  build = build.replace(
    /(buildTypes\s*\{\s*release\s*\{)/,
    "$1\n            signingConfig signingConfigs.release",
  );
}

fs.writeFileSync(buildFile, build);
console.log(`Configured signed Android release ${versionName} (${versionCode})`);
