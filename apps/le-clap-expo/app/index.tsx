import { Redirect } from 'expo-router';

// Redirect to app home
export default function RedirectToApp() {
  return <Redirect href="/(app)" />;
}