import { useDimensions } from '@app/hooks/useDimensions'
import { css, cx } from '@emotion/css'
import { useBlockSuspense, useFetchStoryChunk } from '@app/hooks/api'
import React, { useEffect, useMemo, useRef } from 'react'
import scrollIntoView from 'scroll-into-view-if-needed'
import { Editor, Story, Thought } from '@app/types'
import { BlockingUI } from './BlockingUI'
import { BlockTitle } from './editor'
import { ContentBlocks } from './editor/ContentBlock'
import { BlockAdminContext, useBlockAdminProvider } from './editor/hooks/useBlockAdminProvider'

export function SmallStory(props: { storyId: string; blockId?: string; className?: string; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { height: containerHeight } = useDimensions(containerRef, 0)
  const { height: contentHeight } = useDimensions(contentRef, 0)

  const isOverflow = useMemo(() => {
    return contentHeight > containerHeight
  }, [containerHeight, contentHeight])

  return (
    <div
      className={cx(
        css`
          position: relative;
          overflow: hidden;
        `,
        props.className
      )}
      style={{
        backgroundColor: props.color
      }}
    >
      <div
        className={css`
          height: 100%;
          overflow-y: auto;
          &::-webkit-scrollbar {
            display: none;
          }
          position: relative;
        `}
        ref={containerRef}
      >
        <div ref={contentRef}>
          <React.Suspense fallback={<BlockingUI blocking />}>
            <StoryContent storyId={props.storyId} blockId={props.blockId} containerRef={containerRef} />
          </React.Suspense>
        </div>
      </div>
      {props.blockId && isOverflow ? (
        <div
          className={css`
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 15%;
          `}
          style={{ background: `linear-gradient(180deg, ${props.color}, transparent)` }}
        />
      ) : null}
      {isOverflow && (
        <div
          className={css`
            position: absolute;
            left: 0;
            bottom: 0;
            width: 100%;
            height: 15%;
          `}
          style={{ background: `linear-gradient(0deg, ${props.color}, transparent)` }}
        />
      )}
    </div>
  )
}

const StoryContent: React.FC<{ storyId: string; blockId?: string; containerRef: React.RefObject<HTMLDivElement> }> = ({
  storyId,
  blockId,
  containerRef
}) => {
  useFetchStoryChunk(storyId)
  const story = useBlockSuspense<Story | Thought>(storyId)

  const blockAdminValue = useBlockAdminProvider(storyId)

  useEffect(() => {
    if (!blockId) return
    blockAdminValue.getBlockInstanceById(blockId).then((res) => {
      scrollIntoView(res.wrapperElement, {
        scrollMode: 'if-needed',
        block: 'center',
        inline: 'nearest',
        boundary: containerRef.current
      })
    })
  }, [blockAdminValue, blockId, containerRef])

  return (
    <BlockAdminContext.Provider value={blockAdminValue}>
      <div
        className={cx(
          css`
            padding-top: 10px;
            font-weight: 600;
            position: relative;
          `,
          blockId === storyId &&
            css`
              background: rgba(46, 115, 252, 0.2);
            `
        )}
      >
        {story ? <BlockTitle block={story} /> : ''}
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          align-items: center;
        `}
      >
        {story?.children && (
          <ContentBlocks
            blockIds={story?.children}
            readonly
            parentType={Editor.BlockType.Story}
            small
            highlightedBlockId={blockId}
          />
        )}
      </div>
    </BlockAdminContext.Provider>
  )
}
