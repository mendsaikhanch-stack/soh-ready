import { redirect } from 'next/navigation';

// /vote → /proposal руу чиглүүлнэ (санал асуулга үүсгэх нээлттэй хуудас)
export default function VoteIndexPage() {
  redirect('/proposal');
}
