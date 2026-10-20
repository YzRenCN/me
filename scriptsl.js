
/**
 * 扫雷游戏核心逻辑类
 */
class Minesweeper {
    constructor() {
        // 游戏配置
        this.config = {
            easy: { rows: 9, cols: 9, mines: 10 },
            medium: { rows: 16, cols: 16, mines: 40 },
            hard: { rows: 16, cols: 30, mines: 99 }
        };
        
        // 当前状态
        this.currentLevel = 'easy';
        this.rows = 9;
        this.cols = 9;
        this.totalMines = 10;
        
        // 游戏数据
        this.board = []; // 存储地雷信息 (-1为雷, 0-8为数字)
        this.revealed = []; // 存储是否已翻开
        this.flagged = []; // 存储是否已标记
        this.gameOver = false;
        this.firstClick = true;
        this.flagsPlaced = 0;
        this.revealedCount = 0;
        this.timerInterval = null;
        this.seconds = 0;

        // DOM 元素
        this.gridContainer = document.getElementById('grid-container');
        this.mineCountDisplay = document.getElementById('mine-count');
        this.timerDisplay = document.getElementById('timer');
        this.difficultyBtns = document.querySelectorAll('.difficulty-btn');

        // 初始化
        this.init();
    }

    init() {
        this.resetGame();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 防止右键菜单
        this.gridContainer.addEventListener('contextmenu', e => e.preventDefault());
    }

    setDifficulty(level) {
        this.currentLevel = level;
        const config = this.config[level];
        this.rows = config.rows;
        this.cols = config.cols;
        this.totalMines = config.mines;

        // 更新按钮样式
        this.difficultyBtns.forEach(btn => {
            if (btn.dataset.level === level) {
                btn.classList.remove('text-slate-600', 'hover:bg-white/50');
                btn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
            } else {
                btn.classList.add('text-slate-600', 'hover:bg-white/50');
                btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
            }
        });

        this.resetGame();
    }

    resetGame() {
        this.stopTimer();
        this.seconds = 0;
        this.updateTimerDisplay();
        this.gameOver = false;
        this.firstClick = true;
        this.flagsPlaced = 0;
        this.revealedCount = 0;
        this.updateMineCount();

        // 初始化数组
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.revealed = Array(this.rows).fill().map(() => Array(this.cols).fill(false));
        this.flagged = Array(this.rows).fill().map(() => Array(this.cols).fill(false));

        this.renderGrid();
    }

    renderGrid() {
        this.gridContainer.innerHTML = '';
        this.gridContainer.style.gridTemplateColumns = `repeat(${this.cols}, 30px)`;
        this.gridContainer.style.gridTemplateRows = `repeat(${this.rows}, 30px)`;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                // 事件绑定
                cell.addEventListener('click', (e) => this.handleLeftClick(r, c));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.handleRightClick(r, c);
                });
                cell.addEventListener('dblclick', (e) => this.handleDoubleClick(r, c));

                this.gridContainer.appendChild(cell);
            }
        }
    }

    placeMines(excludeRow, excludeCol) {
        let minesPlaced = 0;
        while (minesPlaced < this.totalMines) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);

            // 确保第一次点击的位置及其周围没有雷 (可选优化：只排除点击位置)
            // 这里简单排除点击位置本身，保证第一步不炸
            if (this.board[r][c] !== -1 && !(r === excludeRow && c === excludeCol)) {
                this.board[r][c] = -1;
                minesPlaced++;
            }
        }

        // 计算数字
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c] === -1) continue;
                this.board[r][c] = this.countAdjacentMines(r, c);
            }
        }
    }

    countAdjacentMines(r, c) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nr = r + i;
                const nc = c + j;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    if (this.board[nr][nc] === -1) count++;
                }
            }
        }
        return count;
    }

    handleLeftClick(r, c) {
        if (this.gameOver || this.flagged[r][c] || this.revealed[r][c]) return;

        if (this.firstClick) {
            this.placeMines(r, c);
            this.firstClick = false;
            this.startTimer();
        }

        this.revealCell(r, c);
        this.checkWin();
    }

    handleRightClick(r, c) {
        if (this.gameOver || this.revealed[r][c]) return;

        const cell = this.getCellElement(r, c);
        
        if (this.flagged[r][c]) {
            this.flagged[r][c] = false;
            this.flagsPlaced--;
            cell.classList.remove('flagged');
            cell.innerHTML = '';
        } else {
            this.flagged[r][c] = true;
            this.flagsPlaced++;
            cell.classList.add('flagged');
            cell.innerHTML = '<i class="fa-solid fa-flag"></i>';
        }
        this.updateMineCount();
    }

    handleDoubleClick(r, c) {
        if (this.gameOver || !this.revealed[r][c] || this.board[r][c] <= 0) return;

        // 计算周围标记的旗帜数量
        let flagCount = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nr = r + i;
                const nc = c + j;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    if (this.flagged[nr][nc]) flagCount++;
                }
            }
        }

        // 如果标记数量等于数字，则自动翻开周围未标记的格子
        if (flagCount === this.board[r][c]) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const nr = r + i;
                    const nc = c + j;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                        if (!this.revealed[nr][nc] && !this.flagged[nr][nc]) {
                            this.revealCell(nr, nc);
                        }
                    }
                }
            }
            this.checkWin();
        }
    }

    revealCell(r, c) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
        if (this.revealed[r][c] || this.flagged[r][c]) return;

        this.revealed[r][c] = true;
        this.revealedCount++;
        
        const cell = this.getCellElement(r, c);
        cell.classList.add('revealed');

        if (this.board[r][c] === -1) {
            // 踩雷
            cell.classList.add('mine');
            cell.innerHTML = '<i class="fa-solid fa-bomb"></i>';
            this.endGame(false);
        } else if (this.board[r][c] > 0) {
            // 显示数字
            cell.textContent = this.board[r][c];
            cell.classList.add(`num-${this.board[r][c]}`);
        } else {
            // 空白格，递归展开
            cell.textContent = '';
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    this.revealCell(r + i, c + j);
                }
            }
        }
    }

    getCellElement(r, c) {
        // 通过索引获取DOM元素，比querySelector快
        const index = r * this.cols + c;
        return this.gridContainer.children[index];
    }

    checkWin() {
        if (this.gameOver) return;
        
        const totalCells = this.rows * this.cols;
        if (this.revealedCount === totalCells - this.totalMines) {
            this.endGame(true);
        }
    }

    endGame(isWin) {
        this.gameOver = true;
        this.stopTimer();

        const modal = document.getElementById('game-over-modal');
        const content = document.getElementById('game-over-content');
        const icon = document.getElementById('game-over-icon');
        const title = document.getElementById('game-over-title');
        const message = document.getElementById('game-over-message');

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // 动画效果
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);

        if (isWin) {
            icon.innerHTML = '<i class="fa-solid fa-trophy text-yellow-500"></i>';
            title.textContent = '恭喜获胜！';
            title.className = 'text-2xl font-bold mb-2 text-green-600';
            message.textContent = `用时: ${this.seconds} 秒`;
            
            // 标记所有剩余地雷为旗帜
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.board[r][c] === -1 && !this.flagged[r][c]) {
                        this.flagged[r][c] = true;
                        const cell = this.getCellElement(r, c);
                        cell.classList.add('flagged');
                        cell.innerHTML = '<i class="fa-solid fa-flag"></i>';
                    }
                }
            }
            this.flagsPlaced = this.totalMines;
            this.updateMineCount();
        } else {
            icon.innerHTML = '<i class="fa-solid fa-skull-crossbones text-red-500"></i>';
            title.textContent = '游戏结束';
            title.className = 'text-2xl font-bold mb-2 text-red-600';
            message.textContent = '你踩到了地雷！';

            // 显示所有地雷
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.board[r][c] === -1) {
                        const cell = this.getCellElement(r, c);
                        if (!this.flagged[r][c]) {
                            cell.classList.add('revealed', 'mine');
                            cell.innerHTML = '<i class="fa-solid fa-bomb"></i>';
                        }
                    } else if (this.flagged[r][c]) {
                        // 标记错误的雷
                        const cell = this.getCellElement(r, c);
                        cell.classList.add('revealed');
                        cell.style.backgroundColor = '#fecaca'; // 浅红背景表示错误标记
                        cell.innerHTML = '<i class="fa-solid fa-xmark text-red-600"></i>';
                    }
                }
            }
        }
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.seconds++;
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        this.timerDisplay.textContent = this.seconds.toString().padStart(3, '0');
    }

    updateMineCount() {
        const remaining = this.totalMines - this.flagsPlaced;
        this.mineCountDisplay.textContent = remaining.toString().padStart(3, '0');
    }

    toggleHelp() {
        const modal = document.getElementById('help-modal');
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
}

// 启动游戏
const game = new Minesweeper();
