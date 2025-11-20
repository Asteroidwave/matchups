/**
 * Simulation API Routes
 * Endpoints for managing race simulations
 */

import express from 'express';
import { simulationController } from '../services/simulationController';
import { SimulationConfig } from '../types/simulation';

const router = express.Router();

/**
 * Create a new simulation
 */
router.post('/create', async (req, res) => {
  try {
    const config: SimulationConfig = {
      contestId: req.body.contestId,
      tracks: req.body.tracks || [],
      date: req.body.date,
      speedMultiplier: req.body.speedMultiplier || 1,
      autoStart: req.body.autoStart || false,
    };
    
    if (!config.contestId || !config.date) {
      return res.status(400).json({ 
        error: 'Missing required fields: contestId, date' 
      });
    }
    
    const simulation = await simulationController.createSimulation(config);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error creating simulation:', error);
    res.status(500).json({
      error: error.message || 'Failed to create simulation',
    });
  }
});

/**
 * Start a simulation
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    await simulationController.startSimulation(id);
    
    const simulation = await simulationController.getSimulation(id, false);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error starting simulation:', error);
    res.status(500).json({
      error: error.message || 'Failed to start simulation',
    });
  }
});

/**
 * Pause a simulation
 */
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    await simulationController.pauseSimulation(id);
    
    const simulation = await simulationController.getSimulation(id, false);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error pausing simulation:', error);
    res.status(500).json({
      error: error.message || 'Failed to pause simulation',
    });
  }
});

/**
 * Resume a simulation
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    await simulationController.resumeSimulation(id);
    
    const simulation = await simulationController.getSimulation(id, false);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error resuming simulation:', error);
    res.status(500).json({
      error: error.message || 'Failed to resume simulation',
    });
  }
});

/**
 * Set simulation speed
 */
router.put('/:id/speed', async (req, res) => {
  try {
    const { id } = req.params;
    const { speedMultiplier } = req.body;
    
    if (!speedMultiplier || speedMultiplier < 1 || speedMultiplier > 100) {
      return res.status(400).json({
        error: 'Invalid speed multiplier (must be 1-100)',
      });
    }
    
    await simulationController.setSpeed(id, speedMultiplier);
    
    const simulation = await simulationController.getSimulation(id, false);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error setting speed:', error);
    res.status(500).json({
      error: error.message || 'Failed to set speed',
    });
  }
});

/**
 * Skip to a specific race
 */
router.post('/:id/skip/:raceIndex', async (req, res) => {
  try {
    const { id, raceIndex } = req.params;
    await simulationController.skipToRace(id, parseInt(raceIndex));
    
    const simulation = await simulationController.getSimulation(id, false);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error skipping to race:', error);
    res.status(500).json({
      error: error.message || 'Failed to skip to race',
    });
  }
});

/**
 * Reset simulation
 */
router.delete('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    await simulationController.resetSimulation(id);
    
    const simulation = await simulationController.getSimulation(id, false);
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error resetting simulation:', error);
    res.status(500).json({
      error: error.message || 'Failed to reset simulation',
    });
  }
});

/**
 * Get simulation status
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Always refresh rounds from database to ensure we have current data
    const simulation = await simulationController.getSimulation(id, true);
    
    if (!simulation) {
      return res.status(404).json({
        error: 'Simulation not found',
      });
    }
    
    res.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    console.error('[Simulation API] Error getting simulation:', error);
    res.status(500).json({
      error: error.message || 'Failed to get simulation',
    });
  }
});

export default router;

