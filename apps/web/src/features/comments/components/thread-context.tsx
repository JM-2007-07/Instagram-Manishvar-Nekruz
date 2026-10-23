'use client';

import { createContext, useContext, useRef, useState } from 'react';

type ReplyTo = { commentId: string; userName: string } | null;

type Thread = {
  replyTo: ReplyTo;
  text: string;
  setText: (text: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  startReply: (commentId: string, userName: string) => void;
  clearReply: () => void;
};

const ThreadContext = createContext<Thread | null>(null);

/** Общее состояние «кому отвечаем» и текст поля: список и форма живут в разных местах окна. */
export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const [replyTo, setReplyTo] = useState<ReplyTo>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  function startReply(commentId: string, userName: string) {
    setReplyTo({ commentId, userName });
    setText(`@${userName} `);
    inputRef.current?.focus();
  }
  function clearReply() {
    setReplyTo(null);
    setText('');
  }

  return (
    <ThreadContext.Provider value={{ replyTo, text, setText, inputRef, startReply, clearReply }}>
      {children}
    </ThreadContext.Provider>
  );
}

export function useThread() {
  return useContext(ThreadContext);
}
