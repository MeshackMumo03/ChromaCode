import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { getBaseUrl } from '@/constants/api';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const BASE_URL = getBaseUrl();
const SOCKET_URL = BASE_URL.replace('/api', '');

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context.socket;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (token && user) {
      // Connect socket if not already connected
      if (!socketRef.current) {
        socketRef.current = io(SOCKET_URL, {
          transports: ['websocket'], // Prefer websocket
        });

        socketRef.current.on('connect', () => {
          console.log('Global Socket: Connected');
          socketRef.current?.emit('join', user._id);
        });

        socketRef.current.on('disconnect', () => {
          console.log('Global Socket: Disconnected');
        });
      }
    } else {
      // Disconnect if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }

    return () => {
      // We don't necessarily want to disconnect on every re-render
      // Only when explicitly cleaned up or user changes
    };
  }, [token, user?._id]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
}
