import { createBrowserRouter } from 'react-router';
import { routePaths } from '@/shared/config';
import { AdminPage } from '@/pages/admin';
import { AdminBattlePage } from '@/pages/admin-battle';
import { BracketPage } from '@/pages/bracket';
import { HomePage } from '@/pages/home';
import { JoinPage } from '@/pages/join';
import { ResultsPage } from '@/pages/results';
import { ScreenPage } from '@/pages/screen';
import { VotePage } from '@/pages/vote';

export const router = createBrowserRouter([
  { path: routePaths.home, element: <HomePage /> },
  { path: routePaths.join, element: <JoinPage /> },
  { path: routePaths.battle, element: <VotePage /> },
  { path: routePaths.bracket, element: <BracketPage /> },
  { path: routePaths.results, element: <ResultsPage /> },
  { path: routePaths.screen, element: <ScreenPage /> },
  { path: routePaths.admin, element: <AdminPage /> },
  { path: routePaths.adminBattle, element: <AdminBattlePage /> },
  { path: '*', element: <HomePage /> },
]);
