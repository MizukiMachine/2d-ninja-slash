export const ATTACK_DAMAGE = 1;
export const PLAYER_MAX_HEALTH = 5;
export const ENEMY_MAX_HEALTH = 1;

export type HealthBand = 'healthy' | 'warning' | 'critical';

export const getHealthRatio = (health: number, maxHealth: number): number => {
  if (maxHealth <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, health / maxHealth));
};

export const applyAttackDamage = (health: number): number =>
  Math.max(0, health - ATTACK_DAMAGE);

export const getHealthBand = (health: number, maxHealth: number): HealthBand => {
  const ratio = getHealthRatio(health, maxHealth);

  if (ratio > 0.5) {
    return 'healthy';
  }

  if (ratio > 0.25) {
    return 'warning';
  }

  return 'critical';
};
