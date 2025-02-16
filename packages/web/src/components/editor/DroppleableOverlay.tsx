import { useDroppable } from '@dnd-kit/core'
import { css } from '@emotion/css'
import React, { useEffect } from 'react'

export const DroppleableOverlay: React.FC<{
  blockId: string
  storyId: string
  type?: string
  dropRef?: React.MutableRefObject<HTMLDivElement | null>
}> = ({ blockId, storyId, dropRef, type }) => {
  const { setNodeRef } = useDroppable({
    id: `drop-block-${type ?? 'normal'}-${blockId}`,
    data: {
      id: blockId,
      storyId: storyId
    }
  })

  useEffect(() => {
    if (dropRef?.current) {
      setNodeRef(dropRef.current)
    }
  }, [dropRef, setNodeRef])

  return !dropRef ? (
    <div
      ref={setNodeRef}
      className={css`
        height: calc(100% + 6px);
        width: 100%;
        left: 0;
        top: -3px;
        position: absolute;
        z-index: 0;
        pointer-events: none;
      `}
    ></div>
  ) : null
}
