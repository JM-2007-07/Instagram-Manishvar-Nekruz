'use client';

import { useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from './store';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Store создаётся внутри компонента, а не в модуле: на сервере глобальный store был бы общим для всех.
  const [store] = useState(makeStore);

  // TODO(T2.A1): здесь появится подключение Socket.IO (lib/realtime.ts) после входа пользователя.
  return <Provider store={store}>{children}</Provider>;
}
