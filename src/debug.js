// Dev-only console helpers. Stripped from production builds (tests/devOnly.test.js checks that).

const DEV_MARKER = 'pawprint-dev-helpers';

Object.assign(globalThis, {
  __pawprint: {
    marker: DEV_MARKER,
    /** Opens the body-plan art-direction mockup. */
    mockup: () => location.assign('/mockups/body-plans/'),
  },
});

console.info('Pawprint Park dev helpers: __pawprint.mockup(), __step(frames)');
