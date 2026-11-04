import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GYM_APP_I18N } from '../js/i18n-gym-app.js';
import { GYM_I18N } from '../js/i18n-gym.js';
import { REST_I18N } from '../js/i18n-restaurant.js';
import { REST_APP_I18N } from '../js/i18n-restaurant-app.js';
import { JEW_I18N } from '../js/i18n-jewellers.js';
import { JEW_APP_I18N } from '../js/i18n-jewellers-app.js';
import { HUB_I18N } from '../js/i18n-hub.js';

const all = { GYM_APP_I18N, GYM_I18N, REST_I18N, REST_APP_I18N, JEW_I18N, JEW_APP_I18N, HUB_I18N };
for (const [name, dict] of Object.entries(all)) {
  test(`${name}: Hindi and Punjabi cover every English label, with the same {placeholders}`, () => {
    for (const lang of ['hi', 'pa']) {
      const missing = Object.keys(dict.en).filter((k) => !(k in dict[lang]));
      assert.deepEqual(missing, [], `${lang} missing keys`);
      for (const k of Object.keys(dict.en)) {
        const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
        assert.equal(ph(dict[lang][k]), ph(dict.en[k]), `${lang}.${k} placeholders`);
      }
    }
  });
}
