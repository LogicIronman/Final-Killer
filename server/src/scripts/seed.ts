import { config } from "../config.js";
import { migrate, openDb } from "../db.js";
import { importQuestionBank } from "../services/questionBank.js";

const db = await openDb(config.databasePath);
await migrate(db);
const result = await importQuestionBank(db, config.questionBankPath);
await db.close();

console.log(`Imported ${result.count} questions into quiz bank ${result.quizBankId}.`);
