import { runUserJourney } from './lib.js';
export const options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
};
export default function () { runUserJourney(); }
