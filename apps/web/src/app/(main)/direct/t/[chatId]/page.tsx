import { ChatView } from '@/features/direct/components/chat-view';

export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return <ChatView chatId={chatId} />;
}
