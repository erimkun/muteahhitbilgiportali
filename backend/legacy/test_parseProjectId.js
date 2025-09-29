// Test parseProjectId function
const { parseProjectId } = require('./utils/helpers');

console.log('Testing parseProjectId function:');
console.log('parseProjectId("1094_5"):', parseProjectId("1094_5"));
console.log('parseProjectId("1"):', parseProjectId("1"));
console.log('parseProjectId(1):', parseProjectId(1));
console.log('parseProjectId("400_111"):', parseProjectId("400_111"));
console.log('parseProjectId("invalid"):', parseProjectId("invalid"));
console.log('parseProjectId(""):', parseProjectId(""));
console.log('parseProjectId(null):', parseProjectId(null));