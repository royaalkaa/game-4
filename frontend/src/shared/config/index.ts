import api from './api.json';
import routes from './routes.json';

export const apiPaths = api;
export const routePaths = routes;

export const VOTER_POLL_MS = 5000;
export const HALL_POLL_MS = 2000;
export const ADMIN_POLL_MS = 2000;
export const QR_REFRESH_MS = 10000;
export const VOTE_RESULT_MS = 1500;
// A swiped card flies off for this long before the next one takes its place.
export const SWIPE_FLY_MS = 260;
