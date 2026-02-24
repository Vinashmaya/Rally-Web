import { redirect } from 'next/navigation';

export default function ManageRoot() {
  redirect('/login');
}
