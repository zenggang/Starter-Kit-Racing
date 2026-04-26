import type { RacingErrorCode } from './protocol';

const ERROR_MESSAGES: Record<RacingErrorCode, string> = {
  ROOM_NOT_FOUND: '房间不存在或已经过期',
  ROOM_CLOSED: '房间已经关闭',
  ROOM_NOT_WAITING: '比赛已经进入赛道，不能继续调整大厅',
  ROOM_EXPIRED: '房间等待超时，请重新创建',
  COLOR_TAKEN: '这辆车已经被其他车手选走',
  COLOR_INVALID: '请选择可用赛车颜色',
  LAP_TARGET_INVALID: '圈数必须在 1 到 10 之间',
  ONLY_HOST_CAN_START: '只有房主可以发车',
  MIN_PLAYERS_REQUIRED: '至少需要 2 名车手才能发车',
  NOT_ALL_PLAYERS_READY: '所有车手都要选车并准备后才能发车',
  PLAYER_NOT_IN_ROOM: '你还不在这个房间里',
  COORDINATOR_NOT_READY: '联机服务暂时不可用',
  AUTH_TICKET_INVALID: '联机凭证失效，请重新进入房间'
};

/**
 * Keeps protocol error codes machine-readable while rendering mobile lobby
 * feedback in Chinese. Unknown strings are shown as-is during development so
 * new coordinator errors do not disappear silently.
 */
export function formatRacingError(errorCode: string | null | undefined): string | null {
  if (!errorCode) return null;
  return ERROR_MESSAGES[errorCode as RacingErrorCode] ?? errorCode;
}
