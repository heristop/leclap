import { Redirect } from 'expo-router';

// This helps prevent 404 errors 
export default function NotFound() {
  return <Redirect href="/" />;
}