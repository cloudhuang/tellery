import { ContentBlocks } from '@app/components/editor/ContentBlock'
import { getDuplicatedBlocksFragment } from '@app/context/editorTranscations'
import { useCreateEmptyBlock } from '@app/helpers/blockFactory'
import { useBlockTranscations } from '@app/hooks/useBlockTranscation'
import { usePushFocusedBlockIdState } from '@app/hooks/usePushFocusedBlockIdState'
import { getBlockFromSnapshot, useBlockSnapshot } from '@app/store/block'
import { Direction, Editor } from '@app/types'
import { DndItemDataType, DnDItemTypes } from '@app/utils/dnd'
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  LayoutMeasuringStrategy,
  MouseSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { css } from '@emotion/css'
import _ from 'lodash'
import React, { memo, ReactNode, useCallback, useRef, useState } from 'react'
import ReactTestUtils from 'react-dom/test-utils'
import invariant from 'tiny-invariant'
import {
  closetBorder,
  FileDraggble,
  findDroppbleBlockIdAndDirection,
  getFakeDragbleElement,
  logger,
  MouseSensorOptions
} from '../context/blockDnd'
import { useSetDroppingArea } from '../hooks/useDroppingArea'
import { DndSensor } from '../lib/dnd-kit/dndSensor'
import { useSetUploadResource } from './editor/hooks/useUploadResource'
import { getSubsetOfBlocksSnapshot } from './editor/utils'

const DEFAULT_LAYOUT_MEASURING = { strategy: LayoutMeasuringStrategy.BeforeDragging }

const _TelleryDNDContext: React.FC<{
  dataTransferRef: React.MutableRefObject<DataTransfer | null>
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  setPreviewData: React.Dispatch<React.SetStateAction<React.ReactNode>>
  children: ReactNode
}> = ({ children, dataTransferRef, setIsDragging, setPreviewData }) => {
  const droppingAreaRef = useRef<{ blockId: string; direction: Direction } | null>(null)
  const setDroppingArea = useSetDroppingArea()
  const mouseSensor = useSensor(MouseSensor, MouseSensorOptions)
  const dragSensor = useSensor(DndSensor)
  const sensors = useSensors(dragSensor, mouseSensor)
  const blockTranscations = useBlockTranscations()
  const createEmptyBlock = useCreateEmptyBlock()
  const setUploadResource = useSetUploadResource()
  const snapshot = useBlockSnapshot()
  const focusBlockHandler = usePushFocusedBlockIdState()

  const handleDragCancel = useCallback(() => {
    logger('drag cancel')
    setIsDragging(false)
    setDroppingArea(null)
    droppingAreaRef.current = null
    setPreviewData(null)
  }, [setDroppingArea, setIsDragging, setPreviewData])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      logger('drag end', event)
      setIsDragging(false)
      setPreviewData(null)
      const item = event.active.data.current as DndItemDataType
      logger('drag end', item, droppingAreaRef.current)
      if (droppingAreaRef.current) {
        if (item.type === DnDItemTypes.Block) {
          const id = droppingAreaRef.current.blockId
          const blockData = item.blockData
          const over = event.over
          if (!over) return
          const overData = over.data.current
          const overStoryId = overData?.storyId
          invariant(overData?.storyId, 'overing story id is null')
          blockTranscations.insertBlocks(overStoryId, {
            blocksFragment: {
              children: [blockData.id],
              data: { [blockData.id]: blockData }
            },
            targetBlockId: id,
            direction: droppingAreaRef.current.direction
          })

          focusBlockHandler(blockData.id, blockData.storyId, false)
        } else if (item.type === DnDItemTypes.BlockIds) {
          const id = droppingAreaRef.current.blockId
          const blockIds = item.ids
          invariant(blockIds, 'blocks i snull')
          const over = event.over
          if (!over) return
          const overData = over.data.current
          const overStoryId = overData?.storyId
          const targetBlock = getBlockFromSnapshot(id, snapshot)
          invariant(overData?.storyId, 'overing story id is null')
          if (item.storyId !== overStoryId) {
            const duplicatedBlocksFragment = getDuplicatedBlocksFragment(
              blockIds,
              getSubsetOfBlocksSnapshot(snapshot, blockIds),
              overStoryId,
              targetBlock.parentId
            )

            blockTranscations.insertBlocks(overStoryId, {
              blocksFragment: duplicatedBlocksFragment,
              targetBlockId: id,
              direction: droppingAreaRef.current.direction
            })
          } else {
            blockTranscations.moveBlocks(overStoryId, {
              blockIds,
              targetBlockId: id,
              direction: droppingAreaRef.current.direction
            })
          }
        } else if (item.type === DnDItemTypes.File) {
          const over = event.over
          if (!over) return
          const overData = over.data.current
          const overStoryId = overData?.storyId
          logger('drga end', event, dataTransferRef.current)
          const files = dataTransferRef.current?.files
          invariant(files, 'files is empty')
          const fileBlocks = Array.from(files).map(() =>
            createEmptyBlock({
              type: Editor.BlockType.File,
              storyId: overStoryId,
              parentId: overStoryId
            })
          )
          blockTranscations.insertBlocks(overStoryId, {
            blocksFragment: {
              children: fileBlocks.map((block) => block.id),
              data: fileBlocks.reduce((a, c) => {
                a[c.id] = c
                return a
              }, {} as Record<string, Editor.BaseBlock>)
            },
            targetBlockId: droppingAreaRef.current.blockId,
            direction: droppingAreaRef.current.direction
          })
          fileBlocks.forEach((block, i) => {
            const file = files[i]
            setUploadResource({ blockId: block.id, file })
          })
          dataTransferRef.current = null
        } else {
          invariant(false, 'not supported dnd item type')
        }
      }

      setDroppingArea(null)
      droppingAreaRef.current = null
    },
    [
      setIsDragging,
      setPreviewData,
      setDroppingArea,
      blockTranscations,
      focusBlockHandler,
      snapshot,
      dataTransferRef,
      createEmptyBlock,
      setUploadResource
    ]
  )

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const over = event.over
      if (!over) return
      const overData = over.data.current
      const leaveBlockId = overData?.id
      if (!leaveBlockId) return
      if (!event.active.rect.current?.translated) return

      const { top, left } = event.active.rect.current.translated
      const dropAreaInfo = findDroppbleBlockIdAndDirection(
        leaveBlockId,
        {
          x: left,
          y: top
        },
        snapshot
      )
      const item = event.active.data.current as DndItemDataType
      if (item.type === DnDItemTypes.BlockIds) {
        const blockIds = item.ids
        // TODO: dnd-kit bug, drag move may trigger before drag start
        // if (!blockIds) return
        // TODO: Restore it
        if (dropAreaInfo && blockIds?.includes(dropAreaInfo[0])) {
          setDroppingArea(null)
        }
      }

      if (dropAreaInfo) {
        setDroppingArea((value) => {
          const [id, direction] = dropAreaInfo as [string, Direction]
          if (value === null || value?.blockId !== id || value?.direction !== direction) {
            const newValue = {
              blockId: id,
              direction: direction
            }
            droppingAreaRef.current = newValue
            return newValue
          }
          droppingAreaRef.current = value
          return value
        })
      } else {
        setDroppingArea(null)
      }
    },
    [setDroppingArea, snapshot]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true)
    const data = event.active.data.current as DndItemDataType
    logger('drag start', event)
    if (!data) return
    if (data.type === DnDItemTypes.Block) {
      setPreviewData(<ContentBlocks blockIds={[data.originalBlockId]} readonly parentType={Editor.BlockType.Story} />)
    } else if (data.type === DnDItemTypes.BlockIds) {
      setPreviewData(<ContentBlocks blockIds={data.ids} readonly parentType={Editor.BlockType.Story} />)
    } else {
      setPreviewData(
        <div
          className={css`
            width: 10px;
            height: 10px;
          `}
        ></div>
      )
    }
  }, [])
  return (
    <DndContext
      collisionDetection={closetBorder}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      sensors={sensors}
      onDragStart={handleDragStart}
      layoutMeasuring={DEFAULT_LAYOUT_MEASURING}
    >
      {children}
    </DndContext>
  )
}

const TelleryDNDContext = memo(_TelleryDNDContext)

export const BlockDndContextProvider: React.FC = ({ children }) => {
  const [previewData, setPreviewData] = useState<ReactNode | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dataTransferRef = useRef<DataTransfer | null>(null)

  return (
    <div
      onDrop={useCallback((e) => {
        dataTransferRef.current = e.dataTransfer
        e.preventDefault()
      }, [])}
      onDragOver={useCallback(
        (e) => {
          if (isDragging === false) {
            logger('on darg entter', e, e.nativeEvent)
            const handle = getFakeDragbleElement()
            const nativeEvent = e.nativeEvent
            e.persist()
            handle.style.left = `${nativeEvent.clientX}px`
            handle.style.top = `${nativeEvent.clientY}px`

            ReactTestUtils.Simulate.dragEnter(handle, {
              nativeEvent: e.nativeEvent,
              clientX: nativeEvent.clientX,
              clientY: nativeEvent.clientY,
              button: nativeEvent.button
            })
          }
        },
        [isDragging]
      )}
    >
      <TelleryDNDContext
        dataTransferRef={dataTransferRef}
        setIsDragging={setIsDragging}
        setPreviewData={setPreviewData}
      >
        <FileDraggble />
        {children}
        <DragOverlay
          dropAnimation={null}
          className={css`
            opacity: 0.5;
          `}
        >
          {isDragging && <React.Suspense fallback={<div>loading...</div>}>{previewData}</React.Suspense>}
        </DragOverlay>
      </TelleryDNDContext>
    </div>
  )
}
