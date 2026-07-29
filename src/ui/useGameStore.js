import { useState, useEffect } from 'react';
import { gameStore } from '../state/gameStore.js';

export function useGameStore() {
  const [state, setState] = useState(gameStore.getState());

  useEffect(() => {
    const unsubscribe = gameStore.subscribe((newState) => {
      setState({ ...newState });
    });
    return unsubscribe;
  }, []);

  return state;
}
