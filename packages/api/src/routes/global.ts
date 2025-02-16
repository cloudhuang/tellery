import { plainToClass } from 'class-transformer'
import { IsArray, IsDefined } from 'class-validator'
import { Context } from 'koa'
import Router from 'koa-router'
import _ from 'lodash'

import { Link } from '../core/link'
import { SearchableResourceType } from '../core/search/interface'
import blockService from '../services/block'
import linkService from '../services/link'
import searchService from '../services/search'
import snapshotService from '../services/snapshot'
import * as userService from '../services/user'
import { BlockDTO, BlockType } from '../types/block'
import { SearchResultDataDTO } from '../types/search'
import { SnapshotDTO } from '../types/snapshot'
import { StoryDTO } from '../types/story'
import { UserInfoDTO } from '../types/user'
import { validate } from '../utils/http'
import { mustGetUser } from '../utils/user'

export class GlobalSearchRequest {
  @IsDefined()
  keyword!: string

  @IsDefined()
  workspaceId!: string

  types?: SearchableResourceType[]

  filters?: { [k: string]: string }

  @IsDefined()
  limit!: number
}

type MgetResourcesType = SearchableResourceType | 'link' | 'snapshot'

class MgetResourcesRequest {
  @IsDefined()
  workspaceId!: string

  @IsDefined()
  @IsArray()
  requests!: {
    type: MgetResourcesType

    // type: story | user | block | snapshot | link(block id)
    id?: string
  }[]

  static transformType(t: MgetResourcesType | string): string {
    switch (t) {
      case 'block':
        return 'blocks'
      case 'user':
        return 'users'
      case 'link':
        return 'links'
      case 'snapshot':
        return 'snapshots'
      default:
        return 'unknown'
    }
  }
}

async function search(ctx: Context) {
  const payload = plainToClass(GlobalSearchRequest, ctx.request.body)
  await validate(ctx, payload)

  const user = mustGetUser(ctx)

  const res = await searchService.searchResources(
    user.id,
    payload.workspaceId,
    payload.keyword,
    payload.types,
    payload.limit,
    payload.filters,
  )
  ctx.body = res
}

async function mgetResources(ctx: Context) {
  const payload = plainToClass(MgetResourcesRequest, ctx.request.body)
  await validate(ctx, payload)

  const { id: uid } = mustGetUser(ctx)
  const { workspaceId } = payload

  const asyncFunctions = _(payload.requests)
    .groupBy('type')
    .map(async (v, k) => {
      const ids = _(v).map('id').compact().value()

      switch (k) {
        case 'block':
          return blockService.mget(uid, workspaceId, ids)
        case 'snapshot':
          return snapshotService.mget(uid, workspaceId, ids)
        case 'user':
          return userService.getInfos(_(v).map('id').compact().value())
        case 'link':
          return linkService.mgetBlockLinks(uid, workspaceId, _(v).map('id').compact().value())
      }
    })
    .value()

  const fieldEditor = (val: any) =>
    // switch (val.resourceType) {
    //   // set pinned field
    //   case 'block':
    //     return { ...val, pinned: _(view?.pinnedList).includes(val.id) }
    // }
    val

  const map = _(await Promise.all(asyncFunctions))
    .flatMap()
    .compact()
    .map(
      (
        v:
          | BlockDTO
          | StoryDTO
          | UserInfoDTO
          | SnapshotDTO
          | { id: string; storyId: string; forwardRefs: Link[]; backwardRefs: Link[] },
      ) => ({
        resourceType: _(v).get('forwardRefs')
          ? 'link'
          : _(payload.requests).find((r) => r.id === v.id)?.type || 'snapshot',
        ...v,
      }),
    )
    .map((m) => fieldEditor(m))
    .groupBy('resourceType')
    .mapValues((v) => _(v).keyBy('id').value())
    .value()

  const res: { [k: string]: any } = {}
  const keys = _(map).keys().value()
  _(keys).forEach((k) => {
    const newK = MgetResourcesRequest.transformType(k)
    res[newK] = map[k]
  })

  ctx.body = res
}

/**
 * Automatically complete references to other block in the editor
 */
async function referenceCompletion(ctx: Context) {
  const payload = plainToClass(GlobalSearchRequest, ctx.request.body)
  await validate(ctx, payload)

  const user = mustGetUser(ctx)
  const { limit } = payload
  const types = [BlockType.QUERY_BUILDER, BlockType.DBT, BlockType.SQL, BlockType.SMART_QUERY]
  const funcs = _(types)
    .map((t) =>
      searchService.searchResources(
        user.id,
        payload.workspaceId,
        payload.keyword,
        [SearchableResourceType.BLOCK],
        limit,
        { type: t },
      ),
    )
    .value()
  const searchedRes = await Promise.all(funcs)

  const rss = _(searchedRes).map('results').value()

  const srs = _(rss).flatMap('searchResults').take(limit).value()

  const results: SearchResultDataDTO = {
    blocks: {},
    highlights: {},
    searchResults: srs,
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const sr of srs) {
    // eslint-disable-next-line no-restricted-syntax
    for (const rs of rss) {
      if (rs.highlights[sr]) {
        results.highlights[sr] = rs.highlights[sr]
      }
      if (rs.blocks && rs.blocks[sr]) {
        results.blocks![sr] = rs.blocks[sr]
      }
    }
  }

  // fill story blocks
  const storyBlocks = await blockService.mget(
    user.id,
    payload.workspaceId,
    _(results.blocks).map('storyId').uniq().value(),
  )
  _(storyBlocks).forEach((b) => {
    results.blocks![b.id] = b
  })

  ctx.body = { results }
}

const router = new Router()

router.post('/search', search)
router.post('/mgetResources', mgetResources)
router.post('/referenceCompletion', referenceCompletion)

export default router
