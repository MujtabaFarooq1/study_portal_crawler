import StateManager from "./src/utils/stateManager.js";
import readline from "readline";

/**
 * Reset crawler state (start from scratch)
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "\n⚠️  This will DELETE all progress and start from scratch!\nAre you sure? (yes/no): ",
  (answer) => {
    if (answer.toLowerCase() === "yes") {
      const stateManager = new StateManager();
      stateManager.reset();
      console.log("\n✅ State has been reset. You can now start a fresh crawl.");
    } else {
      console.log("\n❌ Cancelled. State was not reset.");
    }
    rl.close();
  }
);
