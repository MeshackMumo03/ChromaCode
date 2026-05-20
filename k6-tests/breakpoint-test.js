import { runUserJourney } from './lib.js';
export const options = {
  stages: [
    { duration: '10m', target: 200 },
  ],
};
export default function () { runUserJourney(); }
