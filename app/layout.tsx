import type { Metadata } from 'next';
import './globals.css';
import './field-journal.css';
export const metadata:Metadata={title:'SUMMIT Basecamp | Cathedral Catholic Outdoor Club',description:'The student-led outdoor adventure, service, and leadership club at Cathedral Catholic High School. Explore outings, vote on ideas, and join the crew.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
