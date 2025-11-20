/**
 * WebSocket Service
 * Real-time updates for simulations
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { simulationController } from './simulationController';
import { SimulationEvent } from '../types/simulation';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer): void {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });
  
  io.on('connection', (socket: Socket) => {
    console.log('[WebSocket] Client connected:', socket.id);
    
    // Subscribe to a simulation
    socket.on('subscribe_to_simulation', async (data: { simulationId: string }) => {
      console.log('[WebSocket] Client subscribing to simulation:', data.simulationId);
      socket.join(`simulation:${data.simulationId}`);
      
      // Send current state immediately - refresh rounds from database to ensure fresh data
      const simulation = await simulationController.getSimulation(data.simulationId, true);
      if (simulation) {
        socket.emit('simulation_state', simulation);
      }
    });
    
    // Unsubscribe from a simulation
    socket.on('unsubscribe_from_simulation', (data: { simulationId: string }) => {
      console.log('[WebSocket] Client unsubscribing from simulation:', data.simulationId);
      socket.leave(`simulation:${data.simulationId}`);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('[WebSocket] Client disconnected:', socket.id);
    });
  });
  
  // Listen to simulation events and broadcast to subscribers
  simulationController.on('simulation_event', (event: SimulationEvent) => {
    if (io) {
      const room = `simulation:${event.simulationId}`;
      io.to(room).emit(event.type, event.data);
      console.log('[WebSocket] Broadcast event:', event.type, 'to room:', room);
    }
  });
  
  console.log('[WebSocket] Server initialized');
}

export function getIO(): SocketIOServer | null {
  return io;
}

