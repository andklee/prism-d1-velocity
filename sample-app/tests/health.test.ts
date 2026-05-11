import request from 'supertest';
import app from '../src/index';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('includes uptime in seconds', async () => {
    const response = await request(app).get('/health');

    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('includes timestamp in ISO 8601 format', async () => {
    const response = await request(app).get('/health');

    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.timestamp).toBe('string');

    // Verify it's a valid ISO 8601 timestamp
    const timestamp = new Date(response.body.timestamp);
    expect(timestamp.toISOString()).toBe(response.body.timestamp);
  });

  it('uptime increases between calls', async () => {
    const response1 = await request(app).get('/health');

    // Wait 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    const response2 = await request(app).get('/health');

    expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);
  });
});
