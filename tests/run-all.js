const login = require("./login.spec.js");
const home = require("./home.spec.js");
const scenario = require("./scenario.spec.js");
const phishing = require("./phishing.spec.js");

async function main() {
  const summaries = [];
  summaries.push(await login.run());
  summaries.push(await home.run());
  summaries.push(await scenario.run());
  summaries.push(await phishing.run());

  const totalChecks = summaries.reduce((sum, s) => sum + s.total, 0);
  const totalFailed = summaries.reduce((sum, s) => sum + s.failed, 0);

  console.log("========================================");
  summaries.forEach((s) => {
    console.log(`${s.suiteName}: ${s.total - s.failed}/${s.total}`);
  });
  console.log(`TOTALE: ${totalChecks - totalFailed}/${totalChecks} controlli superati`);
  console.log("========================================");

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
