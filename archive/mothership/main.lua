function love.load()
    love.window.setMode(1200, 800, {
        resizable = false,
        highdpi = true
    })
    
    races = {
        human_unity = {
            name = "Human Unity",
            color1 = {0.31, 0.69, 1},
            color2 = {0.0, 0.2, 0.5}
        },
        human_terra = {
            name = "Human Terra",
            color1 = {0.31, 0.69, 1},
            color2 = {0.0, 0.4, 0.3}
        },
        alien_prime = {
            name = "Alien Prime",
            color1 = {0.25, 0.25, 0.3},
            color2 = {0.6, 0.35, 0.71}
        },
        alien_nova = {
            name = "Alien Nova",
            color1 = {0.25, 0.25, 0.3},
            color2 = {0.94, 0.34, 0.42}
        },
        jack_wild = {
            name = "Jack (Wild)",
            isJack = true
        }
    }
    
    cardScale = 0.7
    cardWidth = 120 * cardScale
    cardHeight = 160 * cardScale
    slotWidth = 40 * cardScale
    slotHeight = 56 * cardScale
    
    placementCounter = 0
    
    mothershipSlotX = 540
    mothershipSlotY = 350
    
    lastResetTime = 0
    lastDrawTime = 0
    
    selectedAttacker = nil
    
    combatState = {
        active = false,
        attacker = nil,
        defender = nil,
        attackerFlip = nil,
        defenderFlip = nil,
        attackerTotal = 0,
        defenderTotal = 0,
        winner = nil,
        startTime = 0
    }
    
    createFullDeck()
    resetGame()
end

function createFullDeck()
    fullDeck = {}
    local ranks = {"A", 2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K"}
    local raceNames = {"human_unity", "human_terra", "alien_prime", "alien_nova"}
    
    for _, rank in ipairs(ranks) do
        for _, raceName in ipairs(raceNames) do
            local race = rank == "J" and "jack_wild" or raceName
            table.insert(fullDeck, {number = rank, race = race})
        end
    end
end

function getCardValue(card)
    if card.number == "A" then return 11 end
    if card.number == "J" or card.number == "Q" or card.number == "K" then return 10 end
    return card.number
end

function shuffleDeck(deckToShuffle)
    for i = #deckToShuffle, 2, -1 do
        local j = love.math.random(i)
        deckToShuffle[i], deckToShuffle[j] = deckToShuffle[j], deckToShuffle[i]
    end
end

function drawCardFromDeck(deckSource, discardSource)
    if #deckSource == 0 then
        if #discardSource > 0 then
            for _, card in ipairs(discardSource) do
                table.insert(deckSource, {number = card.number, race = card.race})
            end
            discardSource = {}
            shuffleDeck(deckSource)
        else
            return nil
        end
    end
    
    if #deckSource > 0 then
        local card = table.remove(deckSource)
        card.inHand = true
        card.slots = {topLeft = nil, topRight = nil, bottomLeft = nil, bottomRight = nil}
        return card
    end
    return nil
end

function generateOpponentShip()
    opponentMothership = nil
    opponentPlacedCards = {}
    
    local validCards = {}
    for _, card in ipairs(opponentDeck) do
        if not races[card.race].isJack then
            table.insert(validCards, card)
        end
    end
    
    if #validCards == 0 then return end
    
    local mothershipCard = validCards[love.math.random(#validCards)]
    
    for i, card in ipairs(opponentDeck) do
        if card == mothershipCard then
            table.remove(opponentDeck, i)
            break
        end
    end
    
    opponentMothership = {
        number = mothershipCard.number,
        race = mothershipCard.race,
        x = 540,
        y = 150,
        z = 0,
        isMothership = true,
        isOpponent = true,
        slots = {topLeft = nil, topRight = nil, bottomLeft = nil, bottomRight = nil}
    }
    
    for cardNum = 1, 3 do
        local placed = false
        local attempts = 0
        
        while not placed and attempts < 50 do
            attempts = attempts + 1
            
            if #opponentDeck == 0 then break end
            
            local randomCard = opponentDeck[love.math.random(#opponentDeck)]
            local validSlots = getValidSlotsForOpponent(randomCard)
            
            if #validSlots > 0 then
                local slot = validSlots[love.math.random(#validSlots)]
                
                for i, card in ipairs(opponentDeck) do
                    if card == randomCard then
                        table.remove(opponentDeck, i)
                        break
                    end
                end
                
                local newCard = {
                    number = randomCard.number,
                    race = randomCard.race,
                    isOpponent = true,
                    slots = {topLeft = nil, topRight = nil, bottomLeft = nil, bottomRight = nil}
                }
                
                snapCardToSlotOpponent(newCard, slot.card, slot.slot)
                table.insert(opponentPlacedCards, newCard)
                placed = true
            end
        end
    end
end

function getValidSlotsForOpponent(draggingCard)
    local slots = {}
    local isJack = races[draggingCard.race].isJack
    
    local allOpponentCards = {opponentMothership}
    for _, card in ipairs(opponentPlacedCards) do
        table.insert(allOpponentCards, card)
    end
    
    for _, targetCard in ipairs(allOpponentCards) do
        local isDefense = targetCard.x < opponentMothership.x
        local targetIsJack = races[targetCard.race].isJack
        
        if isJack then
            local possibleSlots = targetCard.isMothership 
                and {"topLeft", "topRight", "bottomLeft", "bottomRight"}
                or (isDefense and {"topLeft", "bottomLeft"} or {"topRight", "bottomRight"})
            
            for _, slot in ipairs(possibleSlots) do
                if not targetCard.slots[slot] and not isSlotPhysicallyBlockedOpponent(targetCard, slot) then
                    table.insert(slots, {card = targetCard, slot = slot})
                end
            end
        else
            if targetCard.number == draggingCard.number or targetIsJack then
                if targetCard.isMothership then
                    if not targetCard.slots.topLeft and not isSlotPhysicallyBlockedOpponent(targetCard, "topLeft") then
                        table.insert(slots, {card = targetCard, slot = "topLeft"})
                    end
                    if not targetCard.slots.topRight and not isSlotPhysicallyBlockedOpponent(targetCard, "topRight") then
                        table.insert(slots, {card = targetCard, slot = "topRight"})
                    end
                else
                    local slot = isDefense and "topLeft" or "topRight"
                    if not targetCard.slots[slot] and not isSlotPhysicallyBlockedOpponent(targetCard, slot) then
                        table.insert(slots, {card = targetCard, slot = slot})
                    end
                end
            end
            
            if targetCard.race == draggingCard.race or targetIsJack then
                if targetCard.isMothership then
                    if not targetCard.slots.bottomLeft and not isSlotPhysicallyBlockedOpponent(targetCard, "bottomLeft") then
                        table.insert(slots, {card = targetCard, slot = "bottomLeft"})
                    end
                    if not targetCard.slots.bottomRight and not isSlotPhysicallyBlockedOpponent(targetCard, "bottomRight") then
                        table.insert(slots, {card = targetCard, slot = "bottomRight"})
                    end
                else
                    local slot = isDefense and "bottomLeft" or "bottomRight"
                    if not targetCard.slots[slot] and not isSlotPhysicallyBlockedOpponent(targetCard, slot) then
                        table.insert(slots, {card = targetCard, slot = slot})
                    end
                end
            end
        end
    end
    
    return slots
end

function isSlotPhysicallyBlockedOpponent(targetCard, slotName)
    local slotX, slotY, slotW, slotH = getSlotBounds(targetCard, slotName)
    
    for _, card in ipairs(opponentPlacedCards) do
        if card ~= targetCard then
            if doRectsOverlap(card.x, card.y, cardWidth, cardHeight, slotX, slotY, slotW, slotH) then
                return true
            end
        end
    end
    return false
end

function snapCardToSlotOpponent(card, targetCard, slotName)
    if slotName == "topLeft" then
        card.x = targetCard.x - (cardWidth - slotWidth)
        card.y = targetCard.y - (cardHeight - slotHeight)
    elseif slotName == "topRight" then
        card.x = targetCard.x + (cardWidth - slotWidth)
        card.y = targetCard.y - (cardHeight - slotHeight)
    elseif slotName == "bottomLeft" then
        card.x = targetCard.x - (cardWidth - slotWidth)
        card.y = targetCard.y + (cardHeight - slotHeight)
    elseif slotName == "bottomRight" then
        card.x = targetCard.x + (cardWidth - slotWidth)
        card.y = targetCard.y + (cardHeight - slotHeight)
    end
    
    targetCard.slots[slotName] = card
    card.z = #opponentPlacedCards + 1
end

function resetGame()
    placementCounter = 0
    selectedAttacker = nil
    
    combatState = {
        active = false,
        attacker = nil,
        defender = nil,
        attackerFlip = nil,
        defenderFlip = nil,
        attackerTotal = 0,
        defenderTotal = 0,
        winner = nil,
        startTime = 0
    }
    
    deck = {}
    for _, card in ipairs(fullDeck) do
        table.insert(deck, {number = card.number, race = card.race})
    end
    shuffleDeck(deck)
    
    discardPile = {}
    
    opponentDeck = {}
    for _, card in ipairs(fullDeck) do
        table.insert(opponentDeck, {number = card.number, race = card.race})
    end
    shuffleDeck(opponentDeck)
    
    opponentDiscardPile = {}
    
    mothership = nil
    
    placedCards = {}
    
    handCards = {}
    for i = 1, 10 do
        local card = drawCardFromDeck(deck, discardPile)
        if card then
            table.insert(handCards, card)
        end
    end
    
    recenterHand()
    
    allCards = {}
    for _, card in ipairs(handCards) do
        table.insert(allCards, card)
    end
    
    draggedCard = nil
    dragOffsetX = 0
    dragOffsetY = 0
    hoveredCard = nil
    validSlots = {}
    
    generateOpponentShip()
end

function recenterHand()
    local numCards = #handCards
    if numCards == 0 then return end
    
    local spacing = 45 * cardScale
    local totalWidth = (numCards - 1) * spacing
    local startX = 600 - totalWidth / 2
    
    local arcHeight = totalWidth * 0.12
    
    for i, card in ipairs(handCards) do
        local t = (i - 1) / math.max(numCards - 1, 1)
        local centerOffset = (t - 0.5) * 2
        
        card.x = startX + (i - 1) * spacing
        card.y = 680 - arcHeight * (1 - centerOffset * centerOffset)
        
        card.rotation = 0
        if arcHeight > 0 and numCards > 1 then
            card.rotation = math.atan(2 * arcHeight * centerOffset / spacing) * 0.5
        end
        
        card.z = 100 + i
    end
end

function love.update(dt)
    local mouseX, mouseY = love.mouse.getPosition()
    
    -- Check combat animation timeout
    if combatState.active then
        if love.timer.getTime() - combatState.startTime > 3 then
            finishCombat()
        end
    end
    
    if not draggedCard and not combatState.active then
        hoveredCard = getCardAtPosition(mouseX, mouseY)
    else
        hoveredCard = nil
        if draggedCard then
            draggedCard.x = mouseX - dragOffsetX
            draggedCard.y = mouseY - dragOffsetY
            validSlots = calculateValidSlots(draggedCard)
        end
    end
end

function isPointInCard(x, y, card)
    return x >= card.x and x <= card.x + cardWidth and
           y >= card.y and y <= card.y + cardHeight
end

function getCardAtPosition(x, y)
    local sorted = {}
    for _, card in ipairs(allCards) do
        table.insert(sorted, card)
    end
    table.sort(sorted, function(a, b) return a.z > b.z end)
    
    for _, card in ipairs(sorted) do
        if card ~= draggedCard and card.inHand and isPointInCard(x, y, card) then
            return card
        end
    end
    return nil
end

function isDefenseSide(card)
    if not mothership then return card.x < mothershipSlotX end
    return card.x < mothership.x
end

function doRectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2)
    return x1 < x2 + w2 and x1 + w1 > x2 and
           y1 < y2 + h2 and y1 + h1 > y2
end

function isSlotPhysicallyBlocked(targetCard, slotName)
    local slotX, slotY, slotW, slotH = getSlotBounds(targetCard, slotName)
    
    for _, card in ipairs(placedCards) do
        if card ~= targetCard then
            if doRectsOverlap(card.x, card.y, cardWidth, cardHeight, slotX, slotY, slotW, slotH) then
                return true
            end
        end
    end
    return false
end

function calculateValidSlots(draggingCard)
    local slots = {}
    local isJack = races[draggingCard.race].isJack
    
    if not mothership then
        if not isJack then
            table.insert(slots, {card = nil, slot = "mothership"})
        end
        return slots
    end
    
    for _, targetCard in ipairs(allCards) do
        if targetCard ~= draggingCard and not targetCard.inHand then
            local isDefense = isDefenseSide(targetCard)
            local targetIsJack = races[targetCard.race].isJack
            
            if isJack then
                local possibleSlots = targetCard.isMothership 
                    and {"topLeft", "topRight", "bottomLeft", "bottomRight"}
                    or (isDefense and {"topLeft", "bottomLeft"} or {"topRight", "bottomRight"})
                
                for _, slot in ipairs(possibleSlots) do
                    if not targetCard.slots[slot] and not isSlotPhysicallyBlocked(targetCard, slot) then
                        table.insert(slots, {card = targetCard, slot = slot})
                    end
                end
            else
                if targetCard.number == draggingCard.number or targetIsJack then
                    if targetCard.isMothership then
                        if not targetCard.slots.topLeft and not isSlotPhysicallyBlocked(targetCard, "topLeft") then
                            table.insert(slots, {card = targetCard, slot = "topLeft"})
                        end
                        if not targetCard.slots.topRight and not isSlotPhysicallyBlocked(targetCard, "topRight") then
                            table.insert(slots, {card = targetCard, slot = "topRight"})
                        end
                    else
                        local slot = isDefense and "topLeft" or "topRight"
                        if not targetCard.slots[slot] and not isSlotPhysicallyBlocked(targetCard, slot) then
                            table.insert(slots, {card = targetCard, slot = slot})
                        end
                    end
                end
                
                if targetCard.race == draggingCard.race or targetIsJack then
                    if targetCard.isMothership then
                        if not targetCard.slots.bottomLeft and not isSlotPhysicallyBlocked(targetCard, "bottomLeft") then
                            table.insert(slots, {card = targetCard, slot = "bottomLeft"})
                        end
                        if not targetCard.slots.bottomRight and not isSlotPhysicallyBlocked(targetCard, "bottomRight") then
                            table.insert(slots, {card = targetCard, slot = "bottomRight"})
                        end
                    else
                        local slot = isDefense and "bottomLeft" or "bottomRight"
                        if not targetCard.slots[slot] and not isSlotPhysicallyBlocked(targetCard, slot) then
                            table.insert(slots, {card = targetCard, slot = slot})
                        end
                    end
                end
            end
        end
    end
    
    return slots
end

function getSlotBounds(card, slotName)
    if slotName == "mothership" then
        return mothershipSlotX, mothershipSlotY, cardWidth, cardHeight
    end
    
    if slotName == "topLeft" then
        return card.x, card.y, slotWidth, slotHeight
    elseif slotName == "topRight" then
        return card.x + (cardWidth - slotWidth), card.y, slotWidth, slotHeight
    elseif slotName == "bottomLeft" then
        return card.x, card.y + (cardHeight - slotHeight), slotWidth, slotHeight
    elseif slotName == "bottomRight" then
        return card.x + (cardWidth - slotWidth), card.y + (cardHeight - slotHeight), slotWidth, slotHeight
    end
end

function isOutermostCard(card, isOpponent)
    local slots = card.slots
    if not slots then return false end
    
    if isOpponent then
        local isDefense = card.x < opponentMothership.x
        if isDefense then
            return not slots.topLeft and not slots.bottomLeft
        else
            return not slots.topRight and not slots.bottomRight
        end
    else
        local isDefense = card.x < mothership.x
        if isDefense then
            return not slots.topLeft and not slots.bottomLeft
        else
            return not slots.topRight and not slots.bottomRight
        end
    end
end

function getValidDefenseTargets()
    local targets = {}
    
    local hasNonMothershipCards = false
    for _, card in ipairs(opponentPlacedCards) do
        if not card.isMothership then
            hasNonMothershipCards = true
            break
        end
    end
    
    if hasNonMothershipCards then
        -- Only outermost defense cards (left side of opponent mothership)
        for _, card in ipairs(opponentPlacedCards) do
            local isDefense = card.x < opponentMothership.x
            if isDefense and isOutermostCard(card, true) then
                table.insert(targets, card)
            end
        end
    else
        table.insert(targets, opponentMothership)
    end
    
    return targets
end

function startCombat(attacker, defender)
    local attackerFlip = drawCardFromDeck(deck, discardPile)
    local defenderFlip = drawCardFromDeck(opponentDeck, opponentDiscardPile)
    
    if not attackerFlip or not defenderFlip then
        return
    end
    
    local attackerValue = getCardValue(attacker) + getCardValue(attackerFlip)
    local defenderValue = getCardValue(defender) + getCardValue(defenderFlip)
    
    combatState = {
        active = true,
        attacker = attacker,
        defender = defender,
        attackerFlip = attackerFlip,
        defenderFlip = defenderFlip,
        attackerTotal = attackerValue,
        defenderTotal = defenderValue,
        winner = attackerValue > defenderValue and "attacker" or "defender",
        startTime = love.timer.getTime()
    }
end

function finishCombat()
    local attacker = combatState.attacker
    local defender = combatState.defender
    local attackerTotal = combatState.attackerTotal
    local defenderTotal = combatState.defenderTotal
    
    -- Add flipped cards to discard
    table.insert(discardPile, {number = combatState.attackerFlip.number, race = combatState.attackerFlip.race})
    table.insert(opponentDiscardPile, {number = combatState.defenderFlip.number, race = combatState.defenderFlip.race})
    
    if attackerTotal > defenderTotal then
        -- Attacker wins
        table.insert(opponentDiscardPile, {number = defender.number, race = defender.race})
        
        if defender.isMothership then
            opponentMothership = nil
        else
            for i, card in ipairs(opponentPlacedCards) do
                if card == defender then
                    table.remove(opponentPlacedCards, i)
                    break
                end
            end
        end
        
        -- Attacker survives if more than double
        if attackerTotal > defenderTotal * 2 then
            -- Attacker survives!
        else
            -- Attacker is destroyed
            table.insert(discardPile, {number = attacker.number, race = attacker.race})
            
            for i, card in ipairs(placedCards) do
                if card == attacker then
                    table.remove(placedCards, i)
                    break
                end
            end
            for i, card in ipairs(allCards) do
                if card == attacker then
                    table.remove(allCards, i)
                    break
                end
            end
        end
    else
        -- Defender wins, attacker destroyed
        table.insert(discardPile, {number = attacker.number, race = attacker.race})
        
        for i, card in ipairs(placedCards) do
            if card == attacker then
                table.remove(placedCards, i)
                break
            end
        end
        for i, card in ipairs(allCards) do
            if card == attacker then
                table.remove(allCards, i)
                break
            end
        end
    end
    
    selectedAttacker = nil
    combatState.active = false
end

function love.mousepressed(x, y, button)
    if button == 1 then
        -- Skip combat animation
        if combatState.active then
            finishCombat()
            return
        end
        
        local currentTime = love.timer.getTime()
        
        if x >= 20 and x <= 120 and y >= 20 and y <= 60 then
            if currentTime - lastResetTime > 0.3 then
                resetGame()
                lastResetTime = currentTime
            end
            return
        end
        
        if x >= 130 and x <= 230 and y >= 20 and y <= 60 then
            if currentTime - lastDrawTime > 0.2 then
                local card = drawCardFromDeck(deck, discardPile)
                if card then
                    table.insert(handCards, card)
                    table.insert(allCards, card)
                    recenterHand()
                end
                lastDrawTime = currentTime
            end
            return
        end
        
        if mothership then
            for _, card in ipairs(placedCards) do
                if not isDefenseSide(card) and isPointInCard(x, y, card) and isOutermostCard(card, false) then
                    if selectedAttacker == card then
                        selectedAttacker = nil
                    else
                        selectedAttacker = card
                    end
                    return
                end
            end
            
            if selectedAttacker then
                local validTargets = getValidDefenseTargets()
                for _, target in ipairs(validTargets) do
                    if isPointInCard(x, y, target) then
                        startCombat(selectedAttacker, target)
                        return
                    end
                end
            end
        end
        
        local card = getCardAtPosition(x, y)
        if card and card.inHand then
            draggedCard = card
            dragOffsetX = x - card.x
            dragOffsetY = y - card.y
            
            draggedCard.originalHandX = draggedCard.x
            draggedCard.originalHandY = draggedCard.y
            draggedCard.originalHandRotation = draggedCard.rotation
            
            validSlots = calculateValidSlots(draggedCard)
        end
    end
end

function love.mousereleased(x, y, button)
    if button == 1 and draggedCard then
        if draggedCard.number == "K" and y < 267 then
            table.insert(discardPile, {number = draggedCard.number, race = draggedCard.race})
            
            for i, card in ipairs(handCards) do
                if card == draggedCard then
                    table.remove(handCards, i)
                    break
                end
            end
            
            for i, card in ipairs(allCards) do
                if card == draggedCard then
                    table.remove(allCards, i)
                    break
                end
            end
            
            for i = 1, 2 do
                local newCard = drawCardFromDeck(deck, discardPile)
                if newCard then
                    table.insert(handCards, newCard)
                    table.insert(allCards, newCard)
                end
            end
            
            recenterHand()
            draggedCard = nil
            validSlots = {}
            return
        end
        
        if not mothership then
            local mSlotX, mSlotY, mSlotW, mSlotH = getSlotBounds(nil, "mothership")
            if doRectsOverlap(draggedCard.x, draggedCard.y, cardWidth, cardHeight, mSlotX, mSlotY, mSlotW, mSlotH) then
                placementCounter = placementCounter + 1
                draggedCard.x = mothershipSlotX
                draggedCard.y = mothershipSlotY
                draggedCard.isMothership = true
                draggedCard.inHand = false
                draggedCard.rotation = 0
                draggedCard.z = 0
                draggedCard.slots = {topLeft = nil, topRight = nil, bottomLeft = nil, bottomRight = nil}
                mothership = draggedCard
                
                for i, card in ipairs(handCards) do
                    if card == draggedCard then
                        table.remove(handCards, i)
                        break
                    end
                end
                
                recenterHand()
                draggedCard = nil
                validSlots = {}
                return
            else
                draggedCard.x = draggedCard.originalHandX
                draggedCard.y = draggedCard.originalHandY
                draggedCard.rotation = draggedCard.originalHandRotation
                draggedCard = nil
                validSlots = {}
                return
            end
        end
        
        local overlappingSlots = {}
        
        for _, validSlot in ipairs(validSlots) do
            local slotX, slotY, slotW, slotH = getSlotBounds(validSlot.card, validSlot.slot)
            if doRectsOverlap(draggedCard.x, draggedCard.y, cardWidth, cardHeight, slotX, slotY, slotW, slotH) then
                table.insert(overlappingSlots, validSlot)
            end
        end
        
        local snapped = false
        if #overlappingSlots > 0 then
            local closestSlot = nil
            local closestDist = math.huge
            
            for _, slot in ipairs(overlappingSlots) do
                local slotX, slotY, slotW, slotH = getSlotBounds(slot.card, slot.slot)
                local slotCenterX = slotX + slotW / 2
                local slotCenterY = slotY + slotH / 2
                local dx = x - slotCenterX
                local dy = y - slotCenterY
                local dist = dx*dx + dy*dy
                
                if dist < closestDist then
                    closestDist = dist
                    closestSlot = slot
                end
            end
            
            if closestSlot then
                snapCardToSlot(draggedCard, closestSlot.card, closestSlot.slot)
                snapped = true
            end
        end
        
        if snapped then
            for i, card in ipairs(handCards) do
                if card == draggedCard then
                    table.remove(handCards, i)
                    break
                end
            end
            recenterHand()
        else
            draggedCard.x = draggedCard.originalHandX
            draggedCard.y = draggedCard.originalHandY
            draggedCard.rotation = draggedCard.originalHandRotation
        end
        
        draggedCard = nil
        validSlots = {}
    end
end

function snapCardToSlot(card, targetCard, slotName)
    placementCounter = placementCounter + 1
    
    if slotName == "topLeft" then
        card.x = targetCard.x - (cardWidth - slotWidth)
        card.y = targetCard.y - (cardHeight - slotHeight)
    elseif slotName == "topRight" then
        card.x = targetCard.x + (cardWidth - slotWidth)
        card.y = targetCard.y - (cardHeight - slotHeight)
    elseif slotName == "bottomLeft" then
        card.x = targetCard.x - (cardWidth - slotWidth)
        card.y = targetCard.y + (cardHeight - slotHeight)
    elseif slotName == "bottomRight" then
        card.x = targetCard.x + (cardWidth - slotWidth)
        card.y = targetCard.y + (cardHeight - slotHeight)
    end
    
    targetCard.slots[slotName] = card
    card.inHand = false
    card.rotation = 0
    card.z = placementCounter
    
    table.insert(placedCards, card)
end

function drawGradientCard(x, y, width, height, color1, color2)
    local mesh = love.graphics.newMesh({
        {x, y, 0, 0, color1[1], color1[2], color1[3], 1},
        {x + width, y, 1, 0, color1[1], color1[2], color1[3], 1},
        {x + width, y + height, 1, 1, color2[1], color2[2], color2[3], 1},
        {x, y + height, 0, 1, color2[1], color2[2], color2[3], 1}
    }, "fan")
    
    love.graphics.draw(mesh)
end

function drawRainbowStripes(x, y, width, height)
    local colors = {
        {1, 0, 0}, {1, 0.5, 0}, {1, 1, 0}, {0, 1, 0}, {0, 0, 1}, {0.5, 0, 1}
    }
    
    local stripeWidth = 12 * cardScale
    local angle = math.pi / 4
    
    love.graphics.setColor(0.2, 0.2, 0.2)
    love.graphics.rectangle("fill", x, y, width, height)
    
    local diagonal = math.sqrt(width*width + height*height)
    local numStripes = math.ceil(diagonal / stripeWidth) * 2
    
    love.graphics.stencil(function()
        love.graphics.rectangle("fill", x, y, width, height)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
    
    love.graphics.push()
    love.graphics.translate(x + width/2, y + height/2)
    love.graphics.rotate(angle)
    
    for i = -numStripes/2, numStripes/2 do
        local colorIdx = ((i % #colors) + #colors) % #colors + 1
        local col = colors[colorIdx]
        love.graphics.setColor(col[1], col[2], col[3])
        local xPos = i * stripeWidth
        love.graphics.rectangle("fill", xPos - diagonal/2, -diagonal, stripeWidth, diagonal*2)
    end
    
    love.graphics.pop()
    love.graphics.setStencilTest()
end

function drawCard(card, isHovered, isDragged, isSelected)
    local race = races[card.race]
    local scale = 1
    
    if isDragged then
        scale = 1.15
    elseif isSelected then
        scale = 1.1
    end
    
    local x, y = card.x, card.y
    
    love.graphics.push()
    
    if isDragged or isSelected then
        local offset = (cardWidth * scale - cardWidth) / 2
        x, y = x - offset, y - offset
    elseif card.rotation and card.inHand then
        love.graphics.translate(card.x + cardWidth/2, card.y + cardHeight/2)
        love.graphics.rotate(card.rotation)
        love.graphics.translate(-(card.x + cardWidth/2), -(card.y + cardHeight/2))
    end
    
    local w, h = cardWidth * scale, cardHeight * scale
    
    if isDragged then
        love.graphics.setColor(0, 0, 0, 0.5)
        love.graphics.rectangle("fill", x + 6, y + 6, w, h, 8, 8)
    end
    
    local inset = 3 * cardScale
    love.graphics.setColor(1, 1, 1)
    
    if race.isJack then
        drawRainbowStripes(x + inset, y + inset, w - inset*2, h - inset*2)
    else
        drawGradientCard(x + inset, y + inset, w - inset*2, h - inset*2, race.color1, race.color2)
    end
    
    if card.isMothership then
        love.graphics.setColor(1, 0.84, 0, 1)
        love.graphics.setLineWidth(5 * cardScale)
    elseif isSelected then
        love.graphics.setColor(1, 0.2, 0.2, 1)
        love.graphics.setLineWidth(5 * cardScale)
    elseif isHovered then
        love.graphics.setColor(1, 1, 1, 0.8)
        love.graphics.setLineWidth(4 * cardScale)
    else
        love.graphics.setColor(1, 1, 1, 0.4)
        love.graphics.setLineWidth(3 * cardScale)
    end
    love.graphics.rectangle("line", x, y, w, h, 8, 8)
    
    love.graphics.setColor(1, 1, 1)
    love.graphics.print(card.number, x + 12 * scale * cardScale, y + 12 * scale * cardScale, 0, 2 * scale * cardScale, 2 * scale * cardScale)
    love.graphics.print(card.number, x + 42 * scale * cardScale, y + 60 * scale * cardScale, 0, 4 * scale * cardScale, 4 * scale * cardScale)
    love.graphics.print(card.number, x + 85 * scale * cardScale, y + 125 * scale * cardScale, 0, 2 * scale * cardScale, 2 * scale * cardScale)
    
    love.graphics.pop()
end

function drawSlotIndicator(card, slotName)
    local x, y, w, h = getSlotBounds(card, slotName)
    local time = love.timer.getTime()
    local pulse = 0.3 + 0.2 * math.sin(time * 5)
    
    for i = 4, 1, -1 do
        local inset = (4 - i) * 2 * cardScale
        local alpha = (0.15 * i) + pulse * 0.1
        love.graphics.setColor(1, 0.84, 0, alpha)
        love.graphics.setLineWidth(2 * cardScale)
        love.graphics.rectangle("line", x + inset, y + inset, w - inset * 2, h - inset * 2, 3, 3)
    end
    
    love.graphics.setColor(1, 0.84, 0, 0.8 + pulse)
    love.graphics.setLineWidth(3 * cardScale)
    love.graphics.rectangle("line", x, y, w, h, 4, 4)
end

function love.draw()
    love.graphics.setColor(0.1, 0.1, 0.18)
    love.graphics.rectangle("fill", 0, 0, 1200, 800)
    
    -- Combat animation overlay
    if combatState.active then
        love.graphics.setColor(0, 0, 0, 0.8)
        love.graphics.rectangle("fill", 0, 0, 1200, 800)
        
        -- Player side (bottom)
        love.graphics.setColor(1, 1, 1)
        love.graphics.print("PLAYER", 180, 450, 0, 1.5, 1.5)
        
        -- Attacker card
        local attackerX = 150
        local attackerY = 500
        drawCard({number = combatState.attacker.number, race = combatState.attacker.race, x = attackerX, y = attackerY}, false, false, false)
        love.graphics.print("+", 150 + cardWidth + 10, 500 + cardHeight/2 - 10, 0, 2, 2)
        
        -- Attacker flip
        local flipX = 200 + cardWidth
        drawCard({number = combatState.attackerFlip.number, race = combatState.attackerFlip.race, x = flipX, y = attackerY}, false, false, false)
        
        -- Attacker total
        love.graphics.setColor(1, 1, 1)
        love.graphics.print("= " .. combatState.attackerTotal, flipX + cardWidth + 20, 500 + cardHeight/2 - 10, 0, 2, 2)
        
        -- Opponent side (top)
        love.graphics.print("OPPONENT", 700, 100, 0, 1.5, 1.5)
        
        -- Defender card
        local defenderX = 680
        local defenderY = 150
        drawCard({number = combatState.defender.number, race = combatState.defender.race, x = defenderX, y = defenderY}, false, false, false)
        love.graphics.print("+", 680 + cardWidth + 10, 150 + cardHeight/2 - 10, 0, 2, 2)
        
        -- Defender flip
        local defFlipX = 730 + cardWidth
        drawCard({number = combatState.defenderFlip.number, race = combatState.defenderFlip.race, x = defFlipX, y = defenderY}, false, false, false)
        
        -- Defender total
        love.graphics.print("= " .. combatState.defenderTotal, defFlipX + cardWidth + 20, 150 + cardHeight/2 - 10, 0, 2, 2)
        
        -- Winner text
        love.graphics.setColor(1, 0.84, 0)
        local winnerText = combatState.winner == "attacker" and "ATTACKER WINS!" or "DEFENDER WINS!"
        love.graphics.printf(winnerText, 0, 380, 1200, "center", 0, 2.5, 2.5)
        
        love.graphics.setColor(0.7, 0.7, 0.7)
        love.graphics.printf("Click to continue", 0, 430, 1200, "center")
        
        return
    end
    
    -- Reset button
    love.graphics.setColor(0.3, 0.3, 0.4)
    love.graphics.rectangle("fill", 20, 20, 100, 40, 5, 5)
    love.graphics.setColor(1, 1, 1)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 20, 20, 100, 40, 5, 5)
    love.graphics.print("RESET", 38, 28, 0, 1.5, 1.5)
    
    -- Draw button
    local canDraw = (#deck > 0 or #discardPile > 0)
    if canDraw then
        love.graphics.setColor(0.3, 0.3, 0.4)
    else
        love.graphics.setColor(0.2, 0.2, 0.2)
    end
    love.graphics.rectangle("fill", 130, 20, 100, 40, 5, 5)
    if canDraw then
        love.graphics.setColor(1, 1, 1)
    else
        love.graphics.setColor(0.4, 0.4, 0.4)
    end
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 130, 20, 100, 40, 5, 5)
    love.graphics.print("DRAW", 150, 28, 0, 1.5, 1.5)
    
    -- Player Discard pile
    love.graphics.setColor(0.3, 0.3, 0.4)
    love.graphics.rectangle("fill", 20, 80, 100, 140, 5, 5)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 20, 80, 100, 140, 5, 5)
    
    if #discardPile == 0 then
        love.graphics.setColor(0.5, 0.5, 0.5)
        love.graphics.printf("DISCARD\nPILE", 20, 120, 100, "center")
    else
        local topCard = discardPile[#discardPile]
        local smallScale = 0.7
        local smallX = 20 + (100 - cardWidth * smallScale / cardScale) / 2
        local smallY = 80 + (140 - cardHeight * smallScale / cardScale) / 2
        
        love.graphics.push()
        love.graphics.translate(smallX, smallY)
        love.graphics.scale(smallScale / cardScale)
        
        local race = races[topCard.race]
        local inset = 3
        
        love.graphics.setColor(1, 1, 1)
        if race.isJack then
            drawRainbowStripes(inset, inset, cardWidth - inset*2, cardHeight - inset*2)
        else
            drawGradientCard(inset, inset, cardWidth - inset*2, cardHeight - inset*2, race.color1, race.color2)
        end
        
        love.graphics.setColor(1, 1, 1, 0.4)
        love.graphics.setLineWidth(3)
        love.graphics.rectangle("line", 0, 0, cardWidth, cardHeight, 8, 8)
        
        love.graphics.setColor(1, 1, 1)
        love.graphics.print(topCard.number, 12, 12, 0, 2, 2)
        love.graphics.print(topCard.number, 42, 60, 0, 4, 4)
        love.graphics.print(topCard.number, 85, 125, 0, 2, 2)
        
        love.graphics.pop()
    end
    
    -- Player Deck
    love.graphics.setColor(0.3, 0.3, 0.4)
    love.graphics.rectangle("fill", 130, 80, 100, 140, 5, 5)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 130, 80, 100, 140, 5, 5)
    
    for i = 1, 3 do
        local offset = (3 - i) * 3
        love.graphics.setColor(0.4, 0.4, 0.5, 0.3)
        love.graphics.rectangle("fill", 130 + offset, 80 + offset, 100, 140, 5, 5)
    end
    
    love.graphics.setColor(1, 1, 1)
    love.graphics.printf(#deck .. "\nCARDS\nLEFT", 130, 120, 100, "center", 0, 1.2, 1.2)
    
    -- Opponent Discard pile
    love.graphics.setColor(0.4, 0.3, 0.3)
    love.graphics.rectangle("fill", 970, 20, 100, 140, 5, 5)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 970, 20, 100, 140, 5, 5)
    
    if #opponentDiscardPile == 0 then
        love.graphics.setColor(0.5, 0.5, 0.5)
        love.graphics.printf("OPP\nDISCARD", 970, 70, 100, "center")
    else
        local topCard = opponentDiscardPile[#opponentDiscardPile]
        local smallScale = 0.7
        local smallX = 970 + (100 - cardWidth * smallScale / cardScale) / 2
        local smallY = 20 + (140 - cardHeight * smallScale / cardScale) / 2
        
        love.graphics.push()
        love.graphics.translate(smallX, smallY)
        love.graphics.scale(smallScale / cardScale)
        
        local race = races[topCard.race]
        local inset = 3
        
        love.graphics.setColor(1, 1, 1)
        if race.isJack then
            drawRainbowStripes(inset, inset, cardWidth - inset*2, cardHeight - inset*2)
        else
            drawGradientCard(inset, inset, cardWidth - inset*2, cardHeight - inset*2, race.color1, race.color2)
        end
        
        love.graphics.setColor(1, 1, 1, 0.4)
        love.graphics.setLineWidth(3)
        love.graphics.rectangle("line", 0, 0, cardWidth, cardHeight, 8, 8)
        
        love.graphics.setColor(1, 1, 1)
        love.graphics.print(topCard.number, 12, 12, 0, 2, 2)
        love.graphics.print(topCard.number, 42, 60, 0, 4, 4)
        love.graphics.print(topCard.number, 85, 125, 0, 2, 2)
        
        love.graphics.pop()
    end
    
    -- Opponent Deck
    love.graphics.setColor(0.4, 0.3, 0.3)
    love.graphics.rectangle("fill", 1080, 20, 100, 140, 5, 5)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 1080, 20, 100, 140, 5, 5)
    
    for i = 1, 3 do
        local offset = (3 - i) * 3
        love.graphics.setColor(0.5, 0.4, 0.4, 0.3)
        love.graphics.rectangle("fill", 1080 + offset, 20 + offset, 100, 140, 5, 5)
    end
    
    love.graphics.setColor(1, 1, 1)
    love.graphics.printf(#opponentDeck .. "\nCARDS\nLEFT", 1080, 60, 100, "center", 0, 1.2, 1.2)
    
    -- King draw zone
    if draggedCard and draggedCard.number == "K" then
        local time = love.timer.getTime()
        local pulse = 0.3 + 0.2 * math.sin(time * 5)
        love.graphics.setColor(1, 0.84, 0, 0.15 + pulse * 0.1)
        love.graphics.rectangle("fill", 0, 0, 1200, 267)
        love.graphics.setColor(1, 0.84, 0, 0.5 + pulse * 0.2)
        love.graphics.setLineWidth(4)
        love.graphics.line(0, 267, 1200, 267)
        
        love.graphics.setColor(1, 1, 1)
        love.graphics.printf("DROP KING HERE TO DRAW 2 CARDS", 0, 120, 1200, "center", 0, 1.5, 1.5)
    end
    
    -- Mothership slot
    if not mothership then
        local time = love.timer.getTime()
        local pulse = 0.3 + 0.2 * math.sin(time * 5)
        local isDraggingJack = draggedCard and races[draggedCard.race].isJack
        
        if not isDraggingJack then
            love.graphics.setColor(1, 0.84, 0, 0.2 + pulse * 0.1)
            love.graphics.rectangle("fill", mothershipSlotX, mothershipSlotY, cardWidth, cardHeight, 8, 8)
            love.graphics.setColor(1, 0.84, 0, 0.6 + pulse * 0.2)
            love.graphics.setLineWidth(4)
            love.graphics.rectangle("line", mothershipSlotX, mothershipSlotY, cardWidth, cardHeight, 8, 8)
        end
    end
    
    -- Draw opponent cards
    if opponentMothership then
        drawCard(opponentMothership, false, false, false)
    end
    for _, card in ipairs(opponentPlacedCards) do
        drawCard(card, false, false, false)
    end
    
    -- Highlight valid defense targets
    if selectedAttacker then
        local validTargets = getValidDefenseTargets()
        local time = love.timer.getTime()
        local pulse = 0.3 + 0.2 * math.sin(time * 5)
        
        for _, target in ipairs(validTargets) do
            love.graphics.setColor(1, 0.84, 0, 0.3 + pulse * 0.2)
            love.graphics.setLineWidth(5 * cardScale)
            love.graphics.rectangle("line", target.x, target.y, cardWidth, cardHeight, 8, 8)
        end
    end
    
    -- Draw player cards
    local sorted = {}
    for _, card in ipairs(allCards) do
        table.insert(sorted, card)
    end
    table.sort(sorted, function(a, b) return a.z < b.z end)
    
    for _, card in ipairs(sorted) do
        if card ~= draggedCard then
            local isSelected = (card == selectedAttacker)
            drawCard(card, card == hoveredCard, false, isSelected)
        end
    end
    
    if draggedCard then
        for _, validSlot in ipairs(validSlots) do
            drawSlotIndicator(validSlot.card, validSlot.slot)
        end
    end
    
    if draggedCard then
        drawCard(draggedCard, false, true, false)
    end
end