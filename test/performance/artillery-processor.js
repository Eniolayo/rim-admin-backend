/**
 * Artillery Processor Functions
 * Provides dynamic data generation for Artillery tests
 */

module.exports = {
  generateUserId,
  generatePhoneNumber,
  generateLoanAmount,
};

/**
 * Generate a random user ID from the payload or environment
 */
function generateUserId(context, events, done) {
  const userIds = context.vars.$processEnvironment?.USER_IDS
    ? context.vars.$processEnvironment.USER_IDS.split(',')
    : context.vars.userIds
    ? context.vars.userIds.map((u) => u.userId)
    : ['USR-001', 'USR-002', 'USR-003'];

  context.vars.userId = userIds[Math.floor(Math.random() * userIds.length)];
  return done();
}

/**
 * Generate a random Nigerian phone number
 */
function generatePhoneNumber(context, events, done) {
  const networks = ['Airtel', 'MTN', 'Glo', '9mobile'];
  const prefix = Math.floor(Math.random() * 9000000000) + 1000000000;
  context.vars.phoneNumber = `+234${prefix}`;
  context.vars.network = networks[Math.floor(Math.random() * networks.length)];
  return done();
}

/**
 * Generate a random loan amount
 */
function generateLoanAmount(context, events, done) {
  // Generate amount between 1000 and 50000
  context.vars.loanAmount = Math.floor(Math.random() * 49000) + 1000;
  return done();
}



