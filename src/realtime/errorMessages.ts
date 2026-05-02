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
  ONLY_HOST_CAN_REMATCH: '只有房主可以重新发车',
  MIN_PLAYERS_REQUIRED: '至少需要 2 名车手才能发车',
  NOT_ALL_PLAYERS_READY: '所有车手都要选车并准备后才能发车',
  PLAYER_NOT_IN_ROOM: '你还不在这个房间里',
  COORDINATOR_NOT_READY: '联机服务暂时不可用',
  AUTH_TICKET_INVALID: '联机凭证失效，请重新进入房间',
  ROOM_NOT_FINISHED: '比赛还没有结束，暂时不能重新发车',
  MATCH_NOT_FOUND: '比赛状态不存在，请重新进入房间',
  MATCH_NOT_ACTIVE: '比赛还没有正式开始',
  MATCH_NOT_JOINABLE: '比赛暂时不可加入',
  MATCH_PHASE_INVALID: '当前比赛阶段不允许这个操作',
  MATCH_PLAYER_NOT_REGISTERED: '你不在这场比赛的参赛名单里',
  MATCH_PROGRESS_INVALID: '比赛进度数据无效，请重新同步',
  MATCH_PROGRESS_REGRESSION: '比赛进度回退，已要求重新同步',
  MATCH_FINISH_DUPLICATE: '这名车手已经完成比赛',
  MATCH_SYNC_REQUIRED: '比赛状态需要重新同步',
  MATCH_TICKET_ROOM_MISMATCH: '联机凭证与当前房间不匹配'
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
