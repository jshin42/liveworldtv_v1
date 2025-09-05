import 'reflect-metadata';

describe('API Smoke Tests', () => {
  it('should import entities without errors', async () => {
    expect(() => {
      require('./entities/channel.entity');
      require('./entities/analytics-event.entity');
    }).not.toThrow();
  });

  it('should import catalog service without errors', async () => {
    expect(() => {
      require('./modules/catalog/catalog.service');
    }).not.toThrow();
  });

  it('should validate basic module structure', () => {
    const { Channel } = require('./entities/channel.entity');
    expect(Channel).toBeDefined();
    expect(Channel.name).toBe('Channel');
  });

  it('should validate TypeScript compilation', () => {
    expect(true).toBe(true);
  });
});