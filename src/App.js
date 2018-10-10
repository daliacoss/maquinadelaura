import React, { Component } from 'react';
import update from "immutability-helper";
import posed from "react-pose";
import _ from "lodash";
import './App.css';

const BehaviorEnum = Object.freeze({
    TriggerLeft: 1,
    TriggerUp: 2,
    TriggerRight: 3,
    TriggerDown: 4,
    TriggerForward: 5,
    TriggerBackward: 6,
    TriggerCounterClockwise: 7,
    TriggerClockwise: 8,
})

function relativeDirectionToAbsolute(fromAbsolute, toRelative){

    // assumes BehaviorEnum absolute directions are 1 to 4 in clockwise order

    // if toRelative is actually an absolute direction, return it unchanged
    if (toRelative < 5 && toRelative > 0) {
        return toRelative;
    }
    // if fromAbsolute is not absolute, return undefined
    else if (fromAbsolute < 1 || fromAbsolute > 4){
        return;
    }

    var result;

    switch (toRelative){
        case BehaviorEnum.TriggerForward:
            result = fromAbsolute;
            break;
        case BehaviorEnum.TriggerBackward:
            result = (fromAbsolute + 2) % 4 || 4;
            break;
        case BehaviorEnum.TriggerClockwise:
            result = (fromAbsolute + 1) % 4 || 4;
            break;
        case BehaviorEnum.TriggerCounterClockwise:
            result = (fromAbsolute + 3) % 4 || 4;
            break;
    }

    return result;
}

function newCellData(currentStep=-1){
    return {
        // isPlaying: false,
        timesPlayed: 0,
        mostRecentStepPlayed: -1,
        mostRecentStepAdded: currentStep,
        behaviors: {
            onTriggerByPress: [
                // Math.ceil(Math.random() * BehaviorEnum.TriggerDown)
                BehaviorEnum.TriggerRight,
                // BehaviorEnum.TriggerLeft
            ],
            onTriggerByCell: [
                BehaviorEnum.TriggerClockwise
            ]
        }
    };
}

function nestedUnary(...args){
    // nestedUnary(func1, func2, func3)(initialArg) is equivalent to:
    // func1(func2(func3(initialArg)))

    return (initial) => {
        args.reverse().reduce((a,b) => b(a), initial)
    };
}

function indexToCoords({index, numRows, numCols}){
    return {col: index % numCols, row: Math.floor(index / numCols)};
}

class App extends Component {

    constructor(props) {
        super(props);

        let _state = {
            queue: [],
            isPlaying: false,
            tempo: 100,
            step: -1,
            nextNumRows: 5, // MAGIC VALUE
            nextNumCols: 5, // MAGIC VALUE
            numRows: -1,
            numCols: -1,
            mostRecentGridUpdate: -1
        };

        this.state = this.playStep(_state);
        this.cellPressHandlers = {};

        this.handleCellPress = this.handleCellPress.bind(this);
        this.toggleTimer = this.toggleTimer.bind(this);
        this.setTempoFromForm = this.setTempoFromForm.bind(this);
    }

    componentWillUnmount() {
        this.stopTimer();
    }

    setTimer(tempo) {
        if (! tempo){
            return;
        }
        this.timerID = setInterval(() => this.setState(this.playStep), (6 / tempo) * 2500);
    }

    clearTimer(){
        clearInterval(this.timerID);
    }

    startTimer() {
        if (this.state.isPlaying){
            return false;
        }

        this.setTimer(this.state.tempo);
        this.setState({isPlaying: true});

        return true;
    }

    stopTimer() {
        this.clearTimer();
        this.setState({isPlaying: false});
    }

    toggleTimer() {
        if (! this.startTimer()){
            this.stopTimer();
        }
    }

    setTempoFromForm(e) {
        let tempo = parseFloat(e.target.value);
        if (isNaN(tempo)){
            return;
        }

        this.setState((oldState) => {
            // we have to clear and set the intervals directly instead of using
            // startTimer or stopTimer, since those wrappers rely on potentially
            // outdated state
            this.clearTimer();

            if (oldState.isPlaying){
                this.setTimer(tempo);
            }

            return {tempo}
        });
    }

    handleCellPress(index){

        this.setState((oldState) => {
            return update(oldState, {
                queue: {$push: [{triggeredByIndex: -1, index}]}
            });
        });
    }

    updateNextGridSize(oldState, {numCols, numRows}){
        // do not immediately alter grid size--update will be applied when the
        // next step is played

        let newState = {};

        let shouldUpdateNumCols = (numCols !== undefined && numCols !== oldState.numCols);
        let shouldUpdateNumRows = (numRows !== undefined && numRows !== oldState.numRows);

        if (! (shouldUpdateNumRows || shouldUpdateNumCols)){
            return Object.assign(oldState, newState);
        }

        if (shouldUpdateNumCols){
            newState.nextNumCols = numCols;
        }
        if (shouldUpdateNumRows){
            newState.nextNumRows = numRows;
        }

        return Object.assign(oldState, newState);
    }

    tryUpdateGridSize(oldState, {newStep=oldState.step}={}){
        // may update:
        //  numRows, numCols, nextNumRows, nextNumCols, mostRecentGridUpdate
        // depends:
        //  nextNumRows, nextNumCols
        // may depend:
        //  step

        let newState = {};

        if (oldState.nextNumRows >= 0 || newStep === 0) {
            newState.numRows = oldState.nextNumRows;
            newState.nextNumRows = -1;
            newState.mostRecentGridUpdate = newStep;
        }
        else {
            newState.numRows = oldState.numRows;
        }

        if (oldState.nextNumCols >= 0 || newStep === 0) {
            newState.numCols = oldState.nextNumCols;
            newState.nextNumCols = -1;
            newState.mostRecentGridUpdate = newStep;
        }
        else {
            newState.numCols = oldState.numCols;
        }
        
        return Object.assign(oldState, newState);
    }

    playStep(oldState){
        // calls:
        //  tryUpdateGridSize

        let newState = this.tryUpdateGridSize(
            update(oldState, {step: (x) => x + 1})
        );
        let newQueue = [];
        
        // if grid size has changed on this step, re-create all cells and mark
        // as inactive
        if (newState.mostRecentGridUpdate === newState.step){
            let start = (newState.step) ? oldState.numRows * oldState.numCols : 0;
            for (let i = start; i < newState.numRows * newState.numCols; i++){
                newState[i] = newCellData(newState.step);
            }
            newState.queue = newQueue;
            return Object.assign(oldState, newState);
        }

        let cellsToSetActive = {};

        for (let queueEntry of oldState.queue){
            let index = queueEntry.index;

            let triggeredByIndex = queueEntry.triggeredByIndex;

            let oldCellState = oldState[index];
            let behaviors = oldCellState.behaviors[(triggeredByIndex < 0) ? "onTriggerByPress" : "onTriggerByCell"];

            for (let i in behaviors){
                let cellToQueue = -1;

                // if triggered by a press, relative directions are
                // meaningless, so use behavior as is. if triggered by
                // another cell, and the behavior to respond with is a
                // relative direction, convert that to an absolute direction

                let absoluteBehavior = (triggeredByIndex < 0) ? behaviors[i] :
                                       relativeDirectionToAbsolute(queueEntry.triggeredByDirection, behaviors[i]);

                // determine which neighbours, if any, should be triggered
                // on the next cycle

                switch (absoluteBehavior){
                    case BehaviorEnum.TriggerLeft:
                        cellToQueue = (index % newState.numCols) ? index - 1 : cellToQueue;
                        break;
                    case BehaviorEnum.TriggerRight:
                        cellToQueue = (index % newState.numCols !== newState.numCols - 1) ? index + 1 : cellToQueue;
                        break;
                    case BehaviorEnum.TriggerUp:
                        cellToQueue = (index >= newState.numCols) ? index - newState.numCols : cellToQueue;
                        break;
                    case BehaviorEnum.TriggerDown:
                        cellToQueue = (index < (newState.numRows - 1) * newState.numCols) ? index + newState.numCols : cellToQueue;
                        break;
                }

                if (cellToQueue >= 0){
                    newQueue.push({index: cellToQueue, triggeredByIndex: index, triggeredByDirection: absoluteBehavior});
                }
            }

            cellsToSetActive[index] = true;
        }

        for (let i = 0; i < newState.numRows * newState.numCols; i++){

            if (cellsToSetActive[i]) {
                newState[i] = update(oldState[i], {
                    timesPlayed: {$apply: (x) => x + 1},
                    mostRecentStepPlayed: {$set: newState.step}
                });
            }
        }

        newState.queue = newQueue;

        return Object.assign(oldState, newState);
    }

    render() {
        let onClick = () => {
            let gridSize = {
                numRows: Math.ceil(Math.random() * 7),
                numCols: Math.ceil(Math.random() * 7),
            }
            // this.setState({numRows, numCols});
            this.setState((oldState) => this.updateNextGridSize(oldState, gridSize));
        };

        let grid = [];
        for (let i = 0; i < this.state.numRows * this.state.numCols; i++){
            let cellData = this.state[i];
            grid.push(cellData);
        }

        return (
          <div className="App">
            <p>Hello world!</p>

            <Matrix
            width="600px" // MAGIC VALUE
            height="600px" // MAGIC VALUE
            numRows={this.state.numRows}
            numCols={this.state.numCols}
            onCellPressed={this.handleCellPress}
            step={this.state.step}
            mostRecentGridUpdate={this.state.mostRecentGridUpdate}
            grid={grid}
            />

            <br/>

            <button onClick={() => this.setState(this.playStep)}>next step</button>
            <button onClick={this.toggleTimer}>
                {(this.state.isPlaying) ? "stop" : "start"}
            </button>
            <input type="text" value={this.state.tempo} onChange={this.setTempoFromForm}/>

            <br/>

            <button onClick={onClick}>
                randomize grid size
            </button>
          </div>
        );
    }
}

class Matrix extends Component {

    constructor(props) {

        super(props);
        this.cellPressHandlers = {};
    }

    render() {

        let cells = [];
        let sizeWithPadding = 100 / Math.max(this.props.numCols, this.props.numRows);
        let size = .80 * sizeWithPadding; // MAGIC VALUE
        let diff = (this.props.numCols - this.props.numRows) * sizeWithPadding;

        // create list of <Cell>'s
        for (let i = 0; i < this.props.numRows * this.props.numCols; i++){
            let cellState = this.props.grid[i];
            let col = i % this.props.numCols;
            let row = Math.floor(i / this.props.numCols);
            let useActivePose = cellState.timesPlayed > 0 && (cellState.mostRecentStepPlayed === this.props.step);

            let x = (col * sizeWithPadding) + .5 * (sizeWithPadding - size);
            let y = (row * sizeWithPadding) + .5 * (sizeWithPadding - size);

            // vertically center grid if there are more columns than rows
            if (diff > 0){
                y += diff / 2;
            }
            // horizontally center grid if there are more rows than columns
            else if (diff < 0){
                x += diff / -2;
            }

            let pressHandler = this.cellPressHandlers[i];
            if (! pressHandler){
                pressHandler = (e) => {
                    if (e.button !== 0){
                        return;
                    }
                    this.props.onCellPressed(i);
                }

                this.cellPressHandlers[i] = pressHandler;
            }

            // poseKey allows "active" pose to be retriggered whenever the
            // number of times this cell has played goes up
            let props = {
                key: `${row}-${col}`,
                x: `${x}%`,
                y: `${y}%`,
                width: `${size}%`,
                height: `${size}%`,
                pose: (useActivePose) ? "active" : "inactive",
                initialPose: "inactive",
                poseKey: cellState.timesPlayed,
                fillActive: "#aaff70", // MAGIC VALUE
                fillInactive: "#3333ff", // MAGIC VALUE
                onMouseDown: pressHandler,
            };

            cells.push(<Cell {...props} />);
        }

        return (
            <svg className="Matrix" width={this.props.width} height={this.props.height}>
                { cells }
            </svg>
        )
    }
}

const Cell = posed.rect({
    inactive: {
        fill: ({fillInactive}) => fillInactive,
    },
    active: {
        fill: ({fillActive}) => fillActive,
        transition: ({from, to, fillInactive}) => ({
            type: "keyframes",
            duration: 450, // MAGIC VALUE
            values: [fillInactive, to, fillInactive],
        }),
    },
    props: {fillActive: "#fff", fillInactive: "#000"}
});

export default App;
