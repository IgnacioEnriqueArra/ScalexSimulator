export class Spline2D {
  points: { x: number; y: number }[];
  distances: number[];
  totalLength: number;

  constructor(points: { x: number; y: number }[]) {
    this.points = points;
    this.distances = [0];
    this.totalLength = 0;
    this.calculateDistances();
  }

  calculateDistances() {
    this.totalLength = 0;
    this.distances = [0];
    for (let i = 0; i < this.points.length; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % this.points.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.totalLength += dist;
      this.distances.push(this.totalLength);
    }
  }

  getPoint(t: number): { x: number; y: number } {
    // t is 0 to 1
    t = t - Math.floor(t);
    const p0 = this.points.length;
    const i = Math.floor(t * p0);
    const p1 = this.points[(i - 1 + p0) % p0];
    const p2 = this.points[i];
    const p3 = this.points[(i + 1) % p0];
    const p4 = this.points[(i + 2) % p0];

    const localT = (t * p0) - i;

    const t2 = localT * localT;
    const t3 = t2 * localT;

    const x = 0.5 * (
      (2 * p2.x) +
      (-p1.x + p3.x) * localT +
      (2 * p1.x - 5 * p2.x + 4 * p3.x - p4.x) * t2 +
      (-p1.x + 3 * p2.x - 3 * p3.x + p4.x) * t3
    );

    const y = 0.5 * (
      (2 * p2.y) +
      (-p1.y + p3.y) * localT +
      (2 * p1.y - 5 * p2.y + 4 * p3.y - p4.y) * t2 +
      (-p1.y + 3 * p2.y - 3 * p3.y + p4.y) * t3
    );

    return { x, y };
  }

  getTangent(t: number): { x: number; y: number } {
    const delta = 0.001;
    const p1 = this.getPoint(t);
    const p2 = this.getPoint(t + delta);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / len, y: dy / len };
  }

  getCurvature(t: number): number {
    const delta = 0.01;
    const t1 = this.getTangent(t - delta);
    const t2 = this.getTangent(t + delta);
    
    // Angle between tangents
    const dot = t1.x * t2.x + t1.y * t2.y;
    // Clamp dot product to avoid NaN from acos
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angle = Math.acos(clampedDot);
    
    return angle / (delta * 2);
  }

  getSignedCurvature(t: number): number {
    const delta = 0.01;
    const t1 = this.getTangent(t - delta);
    const t2 = this.getTangent(t + delta);
    
    const cross = t1.x * t2.y - t1.y * t2.x;
    const dot = t1.x * t2.x + t1.y * t2.y;
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angle = Math.acos(clampedDot);
    
    return cross > 0 ? angle / (delta * 2) : -angle / (delta * 2);
  }
}
