import React from 'react'
import { OperatorsContext, useStoryOperatorsProvider } from './hooks/useStoryOperatorsProvider'

export const StoryBlockOperatorsProvider: React.FC<{ storyId: string }> = ({ storyId, children }) => {
  const operators = useStoryOperatorsProvider(storyId)
  return <OperatorsContext.Provider value={operators}>{children}</OperatorsContext.Provider>
}
