/**
 * Script: export-swagger.js
 * يصدّر الـ OpenAPI specs إلى ملف JSON جاهز للرفع على SwaggerHub
 * الاستخدام: node scripts/export-swagger.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const swaggerSpecs = require('../src/config/swagger');

const outputPath = path.join(__dirname, '..', 'swagger.json');

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpecs, null, 2), 'utf8');

console.log('✅ swagger.json generated successfully!');
console.log(`📁 Location: ${outputPath}`);
console.log(`📊 Paths documented: ${Object.keys(swaggerSpecs.paths || {}).length}`);
console.log(`🧩 Schemas defined: ${Object.keys(swaggerSpecs.components?.schemas || {}).length}`);
console.log('\n🚀 Upload this file to: https://editor.swagger.io');
